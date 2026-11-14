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

// The archive is at least once. Select the earliest ingested copy of each
// CloudEvent pair before aggregation; missing identities are reported separately.
const archiveRows = (range: Range) => `WITH ranked_events AS (
	SELECT event_id, event_source, event_type, event_time, value,
		ROW_NUMBER() OVER (
			PARTITION BY event_source, event_id
			ORDER BY __ingest_ts, event_time, event_type, value
		) AS delivery_rank
	FROM ${TABLE}
	WHERE ${since(range)}
), events AS (
	SELECT event_id, event_source, event_type, event_time, value
	FROM ranked_events
	WHERE delivery_rank = 1
		AND event_id IS NOT NULL AND event_id <> ''
		AND event_source IS NOT NULL AND event_source <> ''
)`;

// short_links is produced by rawkode-link with globally generated UUID event IDs.
// Its original schema has no source column; retain this narrower identity scope.
const linkRows = (range: Range) => `WITH ranked_links AS (
	SELECT event_id, event_time, domain, path, matched,
		ROW_NUMBER() OVER (
			PARTITION BY event_id
			ORDER BY __ingest_ts, event_time, domain, path, destination
		) AS delivery_rank
	FROM ${LINKS_TABLE}
	WHERE ${since(range)}
), links AS (
	SELECT event_id, event_time, domain, path, matched
	FROM ranked_links
	WHERE delivery_rank = 1 AND event_id IS NOT NULL AND event_id <> ''
)`;

export const dashboardQueries = (range: Range) => ({
	archiveQuality: `${archiveRows(range)}
		SELECT
			sum(CASE WHEN event_id IS NULL OR event_id = '' OR event_source IS NULL OR event_source = '' THEN 1 ELSE 0 END) AS invalid_records,
			sum(CASE WHEN delivery_rank > 1 AND event_id IS NOT NULL AND event_id <> '' AND event_source IS NOT NULL AND event_source <> '' THEN 1 ELSE 0 END) AS repeated_records
		FROM ranked_events`,

	linkQuality: `${linkRows(range)}
		SELECT
			sum(CASE WHEN event_id IS NULL OR event_id = '' THEN 1 ELSE 0 END) AS invalid_records,
			sum(CASE WHEN delivery_rank > 1 AND event_id IS NOT NULL AND event_id <> '' THEN 1 ELSE 0 END) AS repeated_records
		FROM ranked_links`,

	events: `${archiveRows(range)}
		SELECT ${ARCHIVE_EVENT} AS event, count(*) AS events
		FROM events
		WHERE ${since(range)}
		GROUP BY 1
		ORDER BY events DESC
		LIMIT 100`,

	video: `${archiveRows(range)}
		SELECT nullif(json_get_str(value, 'data', 'video_id'), '') AS video_id,
			sum(CASE WHEN event_type = 'video.play' THEN 1 ELSE 0 END) AS plays,
			sum(CASE WHEN event_type = 'video.complete' THEN 1 ELSE 0 END) AS completes,
			approx_distinct(nullif(nullif(json_get_str(value, 'data', 'distinct_id'), ''), 'anonymous')) AS viewers
		FROM events
		WHERE ${since(range)} AND event_source = 'rawkode-academy-website'
			AND event_type IN ('video.play', 'video.complete')
		GROUP BY 1
		ORDER BY plays DESC
		LIMIT 20`,

	signIn: `${archiveRows(range)}
		SELECT ${ARCHIVE_EVENT} AS event, count(*) AS events
		FROM events
		WHERE ${since(range)} AND ${ARCHIVE_EVENT} IN (${list(Object.values(SIGN_IN_EVENTS))})
		GROUP BY 1`,

	linkTotals: `${linkRows(range)}
		SELECT count(*) AS clicks
		FROM links
		WHERE ${since(range)} AND matched = true`,

	links: `${linkRows(range)}
		SELECT domain, path, count(*) AS clicks
		FROM links
		WHERE ${since(range)} AND matched = true
		GROUP BY 1, 2
		ORDER BY clicks DESC
		LIMIT 25`,

	newsletter: `${archiveRows(range)}
		SELECT ${ARCHIVE_EVENT} AS event, count(*) AS events
		FROM events
		WHERE ${since(range)} AND ${ARCHIVE_EVENT} IN (${list(NEWSLETTER_EVENTS)})
		GROUP BY 1`,
});

export type DashboardQuery = keyof ReturnType<typeof dashboardQueries>;
