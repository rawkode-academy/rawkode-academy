// Compare collector CloudEvents in PostHog and analytics.events_archive.
// Browser events and OTLP logs/metrics are outside this comparison.
//   cuenv task reconcile -e production   # DAYS=14 to widen the window
// Exits 1 for daily drift or a missing Basin day after ingestion began.

import { basinQuery } from "../../../rawkode.academy/website/src/server/basin";

import {
	ARCHIVE_EVENT,
	TABLE,
} from "../../../rawkode.academy/website/src/lib/analytics/queries";

const TOLERANCE = 0.05;
const DAYS = Number(process.env.DAYS ?? 7);

if (!Number.isInteger(DAYS) || DAYS < 1 || DAYS > 90) {
	throw new Error("DAYS must be an integer between 1 and 90");
}

function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set`);
	return value;
}

const now = new Date();
const to = new Date(
	Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
);
const from = new Date(to);
from.setUTCDate(from.getUTCDate() - DAYS);
const fromIso = from.toISOString();
const toIso = to.toISOString();

type Counts = Map<string, Map<string, number>>; // event -> day -> count

function add(counts: Counts, event: string, day: string, count: number) {
	const days = counts.get(event) ?? new Map<string, number>();
	days.set(day, (days.get(day) ?? 0) + count);
	counts.set(event, days);
}

async function posthog(query: string): Promise<unknown[][]> {
	const host = process.env.POSTHOG_APP_HOST ?? "https://eu.posthog.com";
	const response = await fetch(
		`${host}/api/projects/${required("POSTHOG_PROJECT_ID")}/query/`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${required("POSTHOG_PERSONAL_API_KEY")}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
		},
	);
	if (!response.ok) {
		throw new Error(`PostHog ${response.status}: ${await response.text()}`);
	}
	return ((await response.json()) as { results: unknown[][] }).results;
}

// Same client the dashboard uses. Bun has no `caches`, so nothing is cached.
const basinConfig = {
	accountId: required("CLOUDFLARE_ACCOUNT_ID"),
	bucket: process.env.BASIN_BUCKET ?? "rawkode-analytics",
	token: required("BASIN_SQL_TOKEN"),
};
const basin = (query: string) => basinQuery(basinConfig, query);

// The PostHog project's timezone is Europe/London; days are compared in UTC.
const posthogRows = await posthog(`
	SELECT toString(toDate(toTimeZone(timestamp, 'UTC'))) AS day, event, count() AS c
	FROM events
	WHERE timestamp >= toDateTime('${fromIso.slice(0, 19).replace("T", " ")}', 'UTC')
		AND timestamp < toDateTime('${toIso.slice(0, 19).replace("T", " ")}', 'UTC')
		AND properties.$lib = 'observability-collector'
		AND properties.cloudevents_id IS NOT NULL
	GROUP BY day, event`);

const basinRows = await basin(`
	SELECT to_char(date_trunc('day', event_time), '%Y-%m-%d') AS day, ${ARCHIVE_EVENT} AS event, count(*) AS c
	FROM ${TABLE}
	WHERE event_time >= CAST('${fromIso}' AS TIMESTAMP) AND event_time < CAST('${toIso}' AS TIMESTAMP)
	GROUP BY 1, 2`);

const ph: Counts = new Map();
const lake: Counts = new Map();
for (const [day, event, c] of posthogRows) {
	add(ph, String(event), String(day), Number(c));
}
for (const row of basinRows) {
	add(lake, String(row.event), String(row.day), Number(row.c));
}

// Find when ingestion started from __ingest_ts, not a backdated event time: a stream
// that stopped and resumed inside the window must fail, not look like a
// fresh start. The first day is partial unless it began at midnight.
const [startRow] = await basin(
	`SELECT min(__ingest_ts) AS first FROM ${TABLE}`,
);
const firstTs = startRow?.first ? new Date(String(startRow.first)) : undefined;
if (!firstTs || Number.isNaN(firstTs.getTime())) {
	console.error(
		"analytics.events_archive has no rows: the stream isn't receiving data.",
	);
	process.exit(1);
}
const firstFullDay = new Date(
	Date.UTC(
		firstTs.getUTCFullYear(),
		firstTs.getUTCMonth(),
		firstTs.getUTCDate(),
	),
);
if (firstFullDay.getTime() < firstTs.getTime()) {
	firstFullDay.setUTCDate(firstFullDay.getUTCDate() + 1);
}

const days: string[] = [];
for (
	const d = new Date(Math.max(from.getTime(), firstFullDay.getTime()));
	d < to;
	d.setUTCDate(d.getUTCDate() + 1)
) {
	days.push(d.toISOString().slice(0, 10));
}
if (days.length === 0) {
	console.log(
		`Ingestion started ${firstTs.toISOString()}; no full day to compare yet.`,
	);
	process.exit(0);
}

const count = (counts: Counts, event: string, day: string) =>
	counts.get(event)?.get(day) ?? 0;
const total = (counts: Counts, event: string) =>
	days.reduce((sum, day) => sum + count(counts, event, day), 0);

// Each event is checked day by day: window totals can hide a day that ran
// double and another that ran half. The absolute slack stops a single event
// landing either side of midnight failing a low-volume event.
const SLACK = 2;
const allowed = (p: number) => Math.max(p * TOLERANCE, SLACK);

type Line = {
	event: string;
	posthog: number;
	basin: number;
	status: string;
	failing_days: string;
};
const lines: Line[] = [];
let failed = false;

const events = new Set([...ph.keys(), ...lake.keys()]);
for (const event of [...events].sort()) {
	const p = total(ph, event);
	const b = total(lake, event);
	if (p === 0 && b === 0) continue;

	const failing = days.filter((day) => {
		const pd = count(ph, event, day);
		const bd = count(lake, event, day);
		return Math.abs(bd - pd) > allowed(pd);
	});

	let status: string;
	if (failing.length > 0) {
		status = "DRIFT";
		failed = true;
	} else {
		status = "ok";
	}
	lines.push({
		event,
		posthog: p,
		basin: b,
		status,
		failing_days: failing.join(", "),
	});
}

const missingDays = days.filter(
	(day) => ![...lake.values()].some((counts) => (counts.get(day) ?? 0) > 0),
);
if (missingDays.length > 0) failed = true;

console.log(
	`Reconciling ${days[0]} to ${days.at(-1)} (${days.length} full days, ingestion started ${firstTs.toISOString()})\n`,
);
console.table(lines);
if (missingDays.length > 0) {
	console.log(`Basin has no rows at all on: ${missingDays.join(", ")}`);
}

process.exit(failed ? 1 : 0);
