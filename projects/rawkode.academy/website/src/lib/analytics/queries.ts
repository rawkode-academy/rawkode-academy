// The archive stores CloudEvents; typed redirects live in a separate table.
// Filter the physical event_time column so Basin can prune files.
export const TABLE = "analytics.events_archive";
export const LINKS_TABLE = "analytics.short_links";

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

const since = (range: Range) =>
	`event_time >= CAST('${rangeStart(range)}' AS TIMESTAMP)`;

export const SIGN_IN_EVENTS = {
	initiated: "rawkode-academy-website.auth.sign_in_initiated",
	completed: "rawkode-academy-website.auth.sign_in_completed",
	identityCompleted: "rawkode-academy-identity.auth.sign_in_completed",
	registered: "rawkode-academy-identity.auth.user_registered",
	failed: "rawkode-academy-website.custom.sign_in_failed",
} as const;

// Browser CTA impressions and clicks have not migrated to CloudEvents yet.
export const NEWSLETTER_EVENTS = [
	"rawkode-academy-website.newsletter.submission_attempted",
	"rawkode-academy-website.newsletter.subscribed",
] as const;

const list = (values: readonly string[]) =>
	values.map((value) => `'${value}'`).join(", ");

export const dashboardQueries = (range: Range) => ({
	events: `
		SELECT ${ARCHIVE_EVENT} AS event, count(*) AS events
		FROM ${TABLE}
		WHERE ${since(range)}
		GROUP BY 1
		ORDER BY events DESC
		LIMIT 100`,

	video: `
		SELECT nullif(json_get_str(value, 'data', 'video_id'), '') AS video_id,
			sum(CASE WHEN event_type = 'video.play' THEN 1 ELSE 0 END) AS plays,
			sum(CASE WHEN event_type = 'video.complete' THEN 1 ELSE 0 END) AS completes,
			approx_distinct(nullif(nullif(json_get_str(value, 'data', 'distinct_id'), ''), 'anonymous')) AS viewers
		FROM ${TABLE}
		WHERE ${since(range)} AND event_source = 'rawkode-academy-website'
			AND event_type IN ('video.play', 'video.complete')
		GROUP BY 1
		ORDER BY plays DESC
		LIMIT 20`,

	signIn: `
		SELECT ${ARCHIVE_EVENT} AS event, count(*) AS events
		FROM ${TABLE}
		WHERE ${since(range)} AND ${ARCHIVE_EVENT} IN (${list(Object.values(SIGN_IN_EVENTS))})
		GROUP BY 1`,

	linkTotals: `
		SELECT count(*) AS clicks
		FROM ${LINKS_TABLE}
		WHERE ${since(range)} AND matched = true`,

	links: `
		SELECT domain, path, count(*) AS clicks
		FROM ${LINKS_TABLE}
		WHERE ${since(range)} AND matched = true
		GROUP BY 1, 2
		ORDER BY clicks DESC
		LIMIT 25`,

	newsletter: `
		SELECT ${ARCHIVE_EVENT} AS event, count(*) AS events
		FROM ${TABLE}
		WHERE ${since(range)} AND ${ARCHIVE_EVENT} IN (${list(NEWSLETTER_EVENTS)})
		GROUP BY 1`,
});

export type DashboardQuery = keyof ReturnType<typeof dashboardQueries>;
