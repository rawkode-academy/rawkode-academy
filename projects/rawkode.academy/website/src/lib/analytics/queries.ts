// Dashboard queries over `analytics.events`. Every query is bounded by a time
// filter: the Iceberg sink can't be partitioned, so the time range is what
// limits the bytes Basin SQL scans (and bills).

export const TABLE = "analytics.events";

export const RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type Range = keyof typeof RANGES;

export function parseRange(value: string | null): Range {
	return value && value in RANGES ? (value as Range) : "30d";
}

/** Midnight UTC, `days` days ago, so cached results stay stable all day. */
export function rangeStart(range: Range, now = new Date()): string {
	const start = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
	start.setUTCDate(start.getUTCDate() - RANGES[range]);
	return start.toISOString();
}

const since = (range: Range) =>
	`ts >= CAST('${rangeStart(range)}' AS TIMESTAMP)`;

const HUMAN = "is_bot = false";

export const SIGN_IN_EVENTS = {
	initiated: "rawkode-academy-website.auth.sign_in_initiated",
	completed: "rawkode-academy-website.auth.sign_in_completed",
	identityCompleted: "rawkode-academy-identity.auth.sign_in_completed",
	registered: "rawkode-academy-identity.auth.user_registered",
	failed: "rawkode-academy-website.custom.sign_in_failed",
} as const;

export const NEWSLETTER_EVENTS = [
	"newsletter_cta_impression",
	"newsletter_cta_clicked",
	"rawkode-academy-website.newsletter.submission_attempted",
	"rawkode-academy-website.newsletter.subscribed",
] as const;

const list = (values: readonly string[]) =>
	values.map((value) => `'${value}'`).join(", ");

export const dashboardQueries = (range: Range) => ({
	traffic: `
		SELECT to_char(date_trunc('day', ts), '%Y-%m-%d') AS day,
			count(*) AS views,
			approx_distinct(anonymous_id) AS visitors
		FROM ${TABLE}
		WHERE ${since(range)} AND event = 'page_view' AND ${HUMAN}
		GROUP BY 1
		ORDER BY 1`,

	referrers: `
		SELECT referrer_host, count(*) AS views
		FROM ${TABLE}
		WHERE ${since(range)} AND event = 'page_view' AND ${HUMAN}
			AND referrer_host IS NOT NULL AND referrer_host <> 'rawkode.academy'
		GROUP BY 1
		ORDER BY views DESC
		LIMIT 15`,

	campaigns: `
		SELECT utm_source, utm_medium, utm_campaign, count(*) AS views
		FROM ${TABLE}
		WHERE ${since(range)} AND event = 'page_view' AND ${HUMAN}
			AND utm_source IS NOT NULL
		GROUP BY 1, 2, 3
		ORDER BY views DESC
		LIMIT 15`,

	topContent: `
		SELECT url_path,
			count(*) AS views,
			approx_distinct(anonymous_id) AS visitors
		FROM ${TABLE}
		WHERE ${since(range)} AND event = 'page_view' AND ${HUMAN}
		GROUP BY 1
		ORDER BY views DESC
		LIMIT 25`,

	video: `
		SELECT json_get_str(properties_json, 'video_id') AS video_id,
			sum(CASE WHEN event = 'rawkode-academy-website.video.play' THEN 1 ELSE 0 END) AS plays,
			sum(CASE WHEN event = 'rawkode-academy-website.video.complete' THEN 1 ELSE 0 END) AS completes,
			approx_distinct(distinct_id) AS viewers
		FROM ${TABLE}
		WHERE ${since(range)}
			AND event IN ('rawkode-academy-website.video.play', 'rawkode-academy-website.video.complete')
		GROUP BY 1
		ORDER BY plays DESC
		LIMIT 20`,

	signIn: `
		SELECT event, is_bot,
			count(*) AS events,
			approx_distinct(distinct_id) AS people
		FROM ${TABLE}
		WHERE ${since(range)} AND event IN (${list(Object.values(SIGN_IN_EVENTS))})
		GROUP BY 1, 2`,

	links: `
		SELECT url_host, url_path,
			count(*) AS clicks,
			sum(CASE WHEN is_bot THEN 1 ELSE 0 END) AS bot_clicks
		FROM ${TABLE}
		WHERE ${since(range)} AND event = 'rawkode-link.link.redirect'
		GROUP BY 1, 2
		ORDER BY clicks DESC
		LIMIT 25`,

	newsletter: `
		SELECT event, count(*) AS events
		FROM ${TABLE}
		WHERE ${since(range)} AND event IN (${list(NEWSLETTER_EVENTS)}) AND ${HUMAN}
		GROUP BY 1`,
});

export type DashboardQuery = keyof ReturnType<typeof dashboardQueries>;
