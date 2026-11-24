// The archive stores CloudEvents; typed redirects live in a separate table.
// Filter the physical event_time column so Basin can prune files.
export const TABLE = "analytics.events_archive";
// Redirects before 23 November 2026 are in short_links; later ones, with bot
// labels, in short_link_redirects. A sink can't change its table's columns.
export const LEGACY_LINKS_TABLE = "analytics.short_links";
export const LABELLED_LINKS_TABLE = "analytics.short_link_redirects";
export const LINKS_TABLE = `(
		SELECT event_time, domain, path, matched, device, browser, CAST(NULL AS VARCHAR) AS bot_reason
		FROM ${LEGACY_LINKS_TABLE}
		UNION ALL
		SELECT event_time, domain, path, matched, device, browser, bot_reason
		FROM ${LABELLED_LINKS_TABLE}
	) AS links`;

// Match the collector's PostHog event naming, including its missing-source fallback.
export const ARCHIVE_EVENT =
	"concat(coalesce(nullif(event_source, ''), 'unknown'), '.', event_type)";

export const RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type Range = keyof typeof RANGES;

export function parseRange(value: string | null): Range {
	// Own keys only: `in` also accepts "constructor", "__proto__" and friends.
	return value && Object.hasOwn(RANGES, value) ? (value as Range) : "30d";
}

/** Midnight UTC, `days` days ago, so cached results stay stable all day. */
export function rangeStart(range: Range, now = new Date()): string {
	const start = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
	start.setUTCDate(start.getUTCDate() - RANGES[range]);
	return start.toISOString();
}

// The collector labels automated traffic `bot` and names the rule that
// matched in `botreason`. Events stored before labelling get the rules whose
// signals they kept (json_get_str returns '' for a missing key):
// - non-production: browser events from any host but rawkode.academy
// - ua-pattern: the old collector's user-agent verdict on server events
// - desktop-no-browser: a desktop agent with no browser token
// Hosting networks, client hints and webdriver weren't stored, so older
// events from those bots still count as people.
const DEVICE =
	"coalesce(nullif(json_get_str(value, 'device'), ''), json_get_str(value, 'data', 'device'))";
const BROWSER =
	"coalesce(nullif(json_get_str(value, 'browser'), ''), json_get_str(value, 'data', 'browser'))";
export const BOT_REASON = `coalesce(
		nullif(json_get_str(value, 'botreason'), ''),
		CASE
			WHEN event_source = 'rawkode-academy-browser'
				AND json_get_str(value, 'data', 'url_host') <> 'rawkode.academy' THEN 'non-production'
			WHEN json_get_bool(value, 'data', 'is_bot') THEN 'ua-pattern'
			WHEN ${DEVICE} = 'desktop' AND ${BROWSER} = 'other' THEN 'desktop-no-browser'
		END)`;
export const HUMAN = `${BOT_REASON} IS NULL`;

// The same rules for redirects, plus probes of paths that aren't short links.
export const LINK_BOT_REASON = `coalesce(
		nullif(bot_reason, ''),
		CASE
			WHEN device = 'bot' THEN 'ua-pattern'
			WHEN device = 'desktop' AND browser = 'other' THEN 'desktop-no-browser'
			WHEN NOT matched AND path <> '' THEN 'unmatched-path'
		END)`;
export const LINK_HUMAN = `${LINK_BOT_REASON} IS NULL`;

const since = (range: Range) =>
	`event_time >= CAST('${rangeStart(range)}' AS TIMESTAMP)`;

export const SIGN_IN_EVENTS = {
	initiated: "rawkode-academy-website.auth.sign_in_initiated",
	completed: "rawkode-academy-website.auth.sign_in_completed",
	identityCompleted: "rawkode-academy-identity.auth.sign_in_completed",
	registered: "rawkode-academy-identity.auth.user_registered",
	failed: "rawkode-academy-website.custom.sign_in_failed",
} as const;

export const NEWSLETTER_EVENTS = [
	"rawkode-academy-website.newsletter.submission_attempted",
	"rawkode-academy-website.newsletter.subscribed",
] as const;

// Browser events (src/lib/analytics/track.ts) arrive as
// rawkode-academy-browser / web.<event>. Delivery is at-least-once, so counts
// are of distinct event IDs.
export const BROWSER_SOURCE = "rawkode-academy-browser";
const FROM_BROWSER = `event_source = '${BROWSER_SOURCE}'`;
const EVENTS = "approx_distinct(event_id)";
const PATH = "json_get_str(value, 'data', 'url_path')";
const PROPERTY = (key: string) =>
	`nullif(json_get_str(value, 'data', 'properties', '${key}'), '')`;

// Typed browser tables (basin/typed.sql in the collector), for the numeric
// columns the archive's JSON can't aggregate. They hold rows from the day
// their pipeline was created.
export const WEB_VITALS_TABLE = "analytics.web_vitals";
export const WEB_PAGE_LEAVES_TABLE = "analytics.web_page_leaves";
export const TYPED_HUMAN = "NOT coalesce(bot, false)";

// The partnerships funnel, from browser events alone.
export const PARTNERSHIP_PATH = "/organizations/partnerships";
export const FUNNEL_EVENTS = {
	enquiryStarted: "web.enquiry_form_started",
	enquirySubmitted: "web.enquiry_form_submitted",
	ctaClicked: "web.cta_clicked",
	newsletterCtaClicked: "web.newsletter_cta_clicked",
	leadMagnetViewed: "web.lead_magnet_viewed",
} as const;

const list = (values: readonly string[]) =>
	values.map((value) => `'${value}'`).join(", ");

export const dashboardQueries = (range: Range) => ({
	events: `
		SELECT ${ARCHIVE_EVENT} AS event, count(*) AS events
		FROM ${TABLE}
		WHERE ${since(range)} AND ${HUMAN}
		GROUP BY 1
		ORDER BY events DESC
		LIMIT 100`,

	video: `
		SELECT nullif(json_get_str(value, 'data', 'video_id'), '') AS video_id,
			sum(CASE WHEN event_type = 'video.play' THEN 1 ELSE 0 END) AS plays,
			sum(CASE WHEN event_type = 'video.complete' THEN 1 ELSE 0 END) AS completes,
			approx_distinct(nullif(nullif(json_get_str(value, 'data', 'distinct_id'), ''), 'anonymous')) AS viewers
		FROM ${TABLE}
		WHERE ${since(range)} AND ${HUMAN} AND event_source = 'rawkode-academy-website'
			AND event_type IN ('video.play', 'video.complete')
		GROUP BY 1
		ORDER BY plays DESC
		LIMIT 20`,

	signIn: `
		SELECT ${ARCHIVE_EVENT} AS event, count(*) AS events
		FROM ${TABLE}
		WHERE ${since(range)} AND ${HUMAN} AND ${ARCHIVE_EVENT} IN (${list(Object.values(SIGN_IN_EVENTS))})
		GROUP BY 1`,

	linkTotals: `
		SELECT count(*) AS clicks
		FROM ${LINKS_TABLE}
		WHERE ${since(range)} AND ${LINK_HUMAN} AND matched = true`,

	links: `
		SELECT domain, path, count(*) AS clicks
		FROM ${LINKS_TABLE}
		WHERE ${since(range)} AND ${LINK_HUMAN} AND matched = true
		GROUP BY 1, 2
		ORDER BY clicks DESC
		LIMIT 25`,

	newsletter: `
		SELECT ${ARCHIVE_EVENT} AS event, count(*) AS events
		FROM ${TABLE}
		WHERE ${since(range)} AND ${HUMAN} AND ${ARCHIVE_EVENT} IN (${list(NEWSLETTER_EVENTS)})
		GROUP BY 1`,

	traffic: `
		SELECT ${EVENTS} AS views,
			approx_distinct(json_get_str(value, 'data', 'anonymous_id')) AS visitors,
			approx_distinct(json_get_str(value, 'data', 'session_id')) AS sessions
		FROM ${TABLE}
		WHERE ${since(range)} AND ${HUMAN} AND ${FROM_BROWSER} AND event_type = 'web.page_view'`,

	pages: `
		SELECT ${PATH} AS path, ${EVENTS} AS views
		FROM ${TABLE}
		WHERE ${since(range)} AND ${HUMAN} AND ${FROM_BROWSER} AND event_type = 'web.page_view'
		GROUP BY 1
		ORDER BY views DESC
		LIMIT 25`,

	referrers: `
		SELECT coalesce(nullif(json_get_str(value, 'data', 'referrer_host'), ''), 'direct') AS referrer,
			nullif(json_get_str(value, 'data', 'utm_source'), '') AS utm_source,
			${EVENTS} AS views
		FROM ${TABLE}
		WHERE ${since(range)} AND ${HUMAN} AND ${FROM_BROWSER} AND event_type = 'web.page_view'
		GROUP BY 1, 2
		ORDER BY views DESC
		LIMIT 25`,

	funnel: `
		SELECT CASE WHEN event_type = 'web.page_view' THEN 'web.partnerships_view' ELSE event_type END AS step,
			${EVENTS} AS events,
			approx_distinct(json_get_str(value, 'data', 'anonymous_id')) AS visitors
		FROM ${TABLE}
		WHERE ${since(range)} AND ${HUMAN} AND ${FROM_BROWSER}
			AND (event_type IN (${list(Object.values(FUNNEL_EVENTS))})
				OR (event_type = 'web.page_view' AND ${PATH} LIKE '${PARTNERSHIP_PATH}%'))
		GROUP BY 1`,

	clicks: `
		SELECT event_type AS kind,
			coalesce(${PROPERTY("data_attr")}, ${PROPERTY("text")}, ${PROPERTY("href")}, ${PROPERTY("tag")}) AS element,
			${EVENTS} AS clicks
		FROM ${TABLE}
		WHERE ${since(range)} AND ${HUMAN} AND ${FROM_BROWSER}
			AND event_type IN ('web.click', 'web.dead_click', 'web.rage_click')
		GROUP BY 1, 2
		ORDER BY clicks DESC
		LIMIT 30`,

	exceptions: `
		SELECT ${PROPERTY("type")} AS type, ${PROPERTY("message")} AS message,
			${EVENTS} AS events,
			approx_distinct(json_get_str(value, 'data', 'session_id')) AS sessions
		FROM ${TABLE}
		WHERE ${since(range)} AND ${HUMAN} AND ${FROM_BROWSER} AND event_type = 'web.exception'
		GROUP BY 1, 2
		ORDER BY events DESC
		LIMIT 20`,

	vitals: `
		SELECT metric,
			approx_percentile_cont(metric_value, 0.75) AS p75,
			approx_distinct(event_id) AS samples
		FROM ${WEB_VITALS_TABLE}
		WHERE ${since(range)} AND ${TYPED_HUMAN} AND url_host = 'rawkode.academy'
		GROUP BY 1`,

	pageLeave: `
		SELECT approx_median(time_on_page_ms) AS median_time_ms,
			approx_median(max_scroll_pct) AS median_scroll_pct,
			approx_distinct(event_id) AS leaves
		FROM ${WEB_PAGE_LEAVES_TABLE}
		WHERE ${since(range)} AND ${TYPED_HUMAN} AND url_host = 'rawkode.academy'`,
});

export type DashboardQuery = keyof ReturnType<typeof dashboardQueries>;
