import browserSql from "./browser.sql" with { type: "text" };
import { BROWSER_COLUMNS } from "./browser-columns";

export const BROWSER_TABLE = "analytics.browser_events_v1";
const DAY = 86_400_000;

/** Full UTC days only; never interpolate arbitrary SQL or a partial day. */
export function browserWindow(start: string, end: string) {
	for (const value of [start, end]) {
		if (
			!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
			!Number.isFinite(Date.parse(value)) ||
			new Date(value).toISOString().slice(0, 10) !== value
		)
			throw new Error("Browser window requires valid YYYY-MM-DD dates");
	}
	const days = (Date.parse(end) - Date.parse(start)) / DAY;
	if (days < 1 || days > 31)
		throw new Error("Browser window must span 1–31 days");
	return { start: `${start}T00:00:00.000Z`, end: `${end}T00:00:00.000Z`, days };
}

export function browserQueries(start: string, end: string) {
	const window = browserWindow(start, end);
	const range = `event_time >= CAST('${window.start}' AS TIMESTAMP)
		AND event_time < CAST('${window.end}' AS TIMESTAMP)`;
	const columns = BROWSER_COLUMNS.join(", ");
	// Reuse the exact pipeline projection, not a second hand-maintained decoder.
	const expected =
		browserSql
			.replace(/^INSERT INTO \w+\s+/, "")
			.replace("FROM analytics_events\n", "FROM analytics.events_archive\n") +
		` AND ${range}`;
	const compare = `WITH archive_rows AS (${expected}),
		typed_rows AS (SELECT ${columns} FROM ${BROWSER_TABLE} WHERE ${range}),
		expected AS (SELECT DISTINCT ${columns} FROM archive_rows),
		actual AS (SELECT DISTINCT ${columns} FROM typed_rows),
		missing_typed AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
		unexpected_typed AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)`;
	const conflict = (table: string) => `(SELECT count(*) FROM (
		SELECT event_source, event_id FROM ${table}
		GROUP BY event_source, event_id HAVING count(*) > 1) conflicts)`;
	const invalid = (table: string) => `(SELECT count(*) FROM ${table}
		WHERE event_id IS NULL OR event_id = '' OR event_source IS NULL OR event_source = ''
		OR anonymous_id IS NULL OR anonymous_id = '' OR session_id IS NULL OR session_id = '')`;
	const canonical = `WITH ranked AS (
		SELECT *, row_number() OVER (PARTITION BY event_source, event_id
			ORDER BY __ingest_ts, event_time, event_type, url_path) AS copy_rank
		FROM ${BROWSER_TABLE} WHERE ${range}
	), events AS (SELECT * FROM ranked WHERE copy_rank = 1
		AND event_source = 'rawkode-academy-browser' AND event_id <> ''
		AND anonymous_id <> '' AND session_id <> '')`;
	return {
		parity: `${compare}
		SELECT (SELECT count(*) FROM archive_rows) AS archive_deliveries,
			(SELECT count(*) FROM typed_rows) AS typed_deliveries,
			(SELECT count(*) FROM expected) AS archive_projections,
			(SELECT count(*) FROM actual) AS typed_projections,
			(SELECT count(*) FROM missing_typed) AS missing_typed,
			(SELECT count(*) FROM unexpected_typed) AS unexpected_typed,
			${conflict("expected")} AS archive_conflicts,
			${conflict("actual")} AS typed_conflicts,
			${invalid("archive_rows")} AS archive_invalid,
			${invalid("typed_rows")} AS typed_invalid`,
		traffic: `${canonical}
		SELECT date_trunc('day', event_time) AS day, event_type, count(*) AS events,
			count(DISTINCT anonymous_id) AS anonymous_visitors,
			count(DISTINCT session_id) AS sessions,
			count(DISTINCT nullif(user_id, '')) AS authenticated_users
		FROM events GROUP BY 1, 2 ORDER BY 1, 2`,
		pages: `${canonical}
		SELECT url_host, url_path, referrer_host, count(*) AS page_views,
			count(DISTINCT session_id) AS sessions
		FROM events WHERE event_type = 'web.page_view'
		GROUP BY 1, 2, 3 ORDER BY page_views DESC LIMIT 100`,
		campaigns: `${canonical}
		SELECT first_touch_utm_source, first_touch_utm_medium, first_touch_utm_campaign,
			last_touch_utm_source, last_touch_utm_medium, last_touch_utm_campaign,
			event_type, count(*) AS events, count(DISTINCT session_id) AS sessions
		FROM events GROUP BY 1, 2, 3, 4, 5, 6, 7 ORDER BY events DESC LIMIT 100`,
	};
}

const ZERO_FIELDS = [
	"missing_typed",
	"unexpected_typed",
	"archive_conflicts",
	"typed_conflicts",
	"archive_invalid",
	"typed_invalid",
] as const;
const POSITIVE_FIELDS = [
	"archive_deliveries",
	"typed_deliveries",
	"archive_projections",
	"typed_projections",
] as const;
/** Missing, malformed and empty evidence always fail closed. */
export function browserParityPassed(rows: Record<string, unknown>[]): boolean {
	if (rows.length !== 1) return false;
	const row = rows[0]!;
	const number = (key: string) => {
		const value = row[key];
		if (
			(typeof value !== "number" && typeof value !== "string") ||
			(typeof value === "string" && !/^\d+$/.test(value))
		)
			return NaN;
		const parsed = Number(value);
		return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : NaN;
	};
	return (
		ZERO_FIELDS.every((key) => number(key) === 0) &&
		POSITIVE_FIELDS.every((key) => number(key) > 0) &&
		number("archive_projections") === number("typed_projections") &&
		number("archive_deliveries") >= number("archive_projections") &&
		number("typed_deliveries") >= number("typed_projections")
	);
}
