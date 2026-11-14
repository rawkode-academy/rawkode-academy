// Exact CloudEvent identity parity over settled full UTC days. Browser SDK-only
// PostHog events and OTLP telemetry are outside this comparison.
import { writeFile } from "node:fs/promises";
import { basinQuery } from "../../../rawkode.academy/website/src/server/basin";
import {
	ARCHIVE_EVENT,
	TABLE,
} from "../../../rawkode.academy/website/src/lib/analytics/queries";
import {
	afterCursor,
	compareIdentities,
	crossDayIdentities,
	identity,
	PAGE_SIZE,
	readIdentities,
} from "./event-parity";

const DAYS = Number(process.env.DAYS ?? 7);
if (!Number.isInteger(DAYS) || DAYS < 1 || DAYS > 90)
	throw new Error("DAYS must be an integer between 1 and 90");
function required(name: string) {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set`);
	return value;
}
const config = {
	accountId: required("CLOUDFLARE_ACCOUNT_ID"),
	bucket: process.env.BASIN_BUCKET ?? "rawkode-analytics",
	token: required("BASIN_SQL_TOKEN"),
};
const basin = (query: string) => basinQuery(config, query);

async function posthog(query: string): Promise<unknown[][]> {
	const host = process.env.POSTHOG_APP_HOST ?? "https://eu.posthog.com";
	const response = await fetch(
		`${host}/api/projects/${required("POSTHOG_PROJECT_ID")}/query/`,
		{
			method: "POST",
			signal: AbortSignal.timeout(60_000),
			headers: {
				Authorization: `Bearer ${required("POSTHOG_PERSONAL_API_KEY")}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
		},
	);
	if (!response.ok)
		throw new Error(`PostHog request failed (${response.status})`);
	const payload = (await response.json()) as {
		results?: unknown;
		hasMore?: boolean;
		has_more?: boolean;
	};
	if (
		!Array.isArray(payload.results) ||
		payload.results.some((row) => !Array.isArray(row))
	)
		throw new Error("Unexpected PostHog query result");
	if (
		(payload.hasMore || payload.has_more) &&
		payload.results.length < PAGE_SIZE
	)
		throw new Error("PostHog truncated an identity page");
	return payload.results as unknown[][];
}

const SETTLE_HOURS = Number(process.env.SETTLE_HOURS ?? 6);
if (!Number.isInteger(SETTLE_HOURS) || SETTLE_HOURS < 0 || SETTLE_HOURS > 48)
	throw new Error("SETTLE_HOURS must be an integer between 0 and 48");
const now = new Date();
const settled = new Date(now.getTime() - SETTLE_HOURS * 3_600_000);
const to = new Date(
	Date.UTC(
		settled.getUTCFullYear(),
		settled.getUTCMonth(),
		settled.getUTCDate(),
	),
);
const from = new Date(to);
from.setUTCDate(from.getUTCDate() - DAYS);
const [start] = await basin(`SELECT min(__ingest_ts) AS first FROM ${TABLE}`);
const first = start?.first ? new Date(String(start.first)) : undefined;
if (!first || Number.isNaN(first.getTime()))
	throw new Error(
		"Archive has no valid ingestion start; cannot certify delivery",
	);
const firstFullDay = new Date(
	Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate()),
);
if (firstFullDay < first)
	firstFullDay.setUTCDate(firstFullDay.getUTCDate() + 1);
const results: Array<
	{ day: string; crossDayIdentities: number } & ReturnType<
		typeof compareIdentities
	>
> = [];

const seen = new Map<string, string>();
for (
	const day = new Date(Math.max(from.getTime(), firstFullDay.getTime()));
	day < to;
	day.setUTCDate(day.getUTCDate() + 1)
) {
	const until = new Date(day);
	until.setUTCDate(until.getUTCDate() + 1);
	const beginIso = day.toISOString(),
		endIso = until.toISOString();
	const ph = await readIdentities(async (cursor) =>
		(
			await posthog(`
		SELECT properties.cloudevents_source AS source, properties.cloudevents_id AS event_id,
			min(event) AS event_name, count() AS copies, count(DISTINCT event) AS versions
		FROM events
		WHERE timestamp >= toDateTime('${beginIso.slice(0, 19).replace("T", " ")}', 'UTC')
			AND timestamp < toDateTime('${endIso.slice(0, 19).replace("T", " ")}', 'UTC')
			AND properties.$lib = 'observability-collector' AND properties.cloudevents_id IS NOT NULL
			${afterCursor(cursor, "posthog")}
		GROUP BY source, event_id ORDER BY source, event_id LIMIT ${PAGE_SIZE}
	`)
		).map((row) => identity(row[0], row[1], row[2], row[3], row[4])),
	);
	const lake = await readIdentities(async (cursor) =>
		(
			await basin(`
		SELECT event_source AS source, event_id, min(${ARCHIVE_EVENT}) AS event,
			count(*) AS copies, count(DISTINCT ${ARCHIVE_EVENT}) AS versions
		FROM ${TABLE}
		WHERE event_time >= CAST('${beginIso}' AS TIMESTAMP) AND event_time < CAST('${endIso}' AS TIMESTAMP)
			${afterCursor(cursor, "basin")}
		GROUP BY event_source, event_id ORDER BY event_source, event_id LIMIT ${PAGE_SIZE}
	`)
		).map((row) =>
			identity(row.source, row.event_id, row.event, row.copies, row.versions),
		),
	);
	const parity = compareIdentities(ph, lake);
	const crossDay = crossDayIdentities(
		[...ph, ...lake],
		beginIso.slice(0, 10),
		seen,
	);
	results.push({
		day: beginIso.slice(0, 10),
		...parity,
		crossDayIdentities: crossDay,
		passed: parity.passed && crossDay === 0,
	});
}

const passed = results.length > 0 && results.every((row) => row.passed);
const report = {
	schema_version: 1,
	scope: "collector-cloud-event-id-parity",
	generated_at: now.toISOString(),
	window: {
		from: from.toISOString(),
		to: to.toISOString(),
		ingestion_started: first.toISOString(),
		settle_hours: SETTLE_HOURS,
	},
	status: results.length ? (passed ? "passed" : "failed") : "insufficient_data",
	cutover_ready: false,
	// ID parity does not prove producer acceptance, payload equality, source/family
	// completeness, identity stitching, dashboard correctness or telemetry coverage.
	days: results,
};
if (process.env.RECONCILE_REPORT)
	await writeFile(
		process.env.RECONCILE_REPORT,
		`${JSON.stringify(report, null, 2)}\n`,
		{ mode: 0o600 },
	);
console.table(results.map(({ sources, ...summary }) => summary));
console.log(JSON.stringify(report));
process.exit(passed ? 0 : results.length ? 1 : 2);
