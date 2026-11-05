// Dual-run reconciliation: daily event counts in PostHog vs analytics.events.
//
//   cuenv task reconcile -e production          # last 7 full days
//   DAYS=14 cuenv task reconcile -e production
//
// Each event is compared day by day over every full day since ingestion
// started. Server-side events (`<source>.<type>`, written by both destinations
// from the collector) must agree within TOLERANCE. Browser events should read
// the same or higher in Basin: ad blockers stop posthog-js but not the
// first-party endpoint, and Basin records page views on load rather than after
// idle. Exits 1 when any event fails on any day or Basin is missing a day.

import { basinQuery } from "../../../rawkode.academy/website/src/server/basin";

const TOLERANCE = 0.05;
const DAYS = Number(process.env.DAYS ?? 7);

const POSTHOG_ONLY = new Set([
	"$autocapture",
	"$dead_click",
	"$dead_swipe",
	"$rageclick",
	"$web_vitals",
	"$identify",
	"$pageview",
	"$pageleave",
	"$set",
]);
const BASIN_ONLY = new Set(["web_vitals"]);
const SIGN_IN_INITIATED = "rawkode-academy-website.auth.sign_in_initiated";
const SIGN_IN_COMPLETED = "rawkode-academy-website.auth.sign_in_completed";

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
	GROUP BY day, event`);

const basinRows = await basin(`
	SELECT to_char(date_trunc('day', ts), '%Y-%m-%d') AS day, event, count(*) AS c
	FROM analytics.events
	WHERE ts >= CAST('${fromIso}' AS TIMESTAMP) AND ts < CAST('${toIso}' AS TIMESTAMP)
	GROUP BY 1, 2`);

const ph: Counts = new Map();
const lake: Counts = new Map();
for (const [day, event, c] of posthogRows) {
	add(ph, String(event), String(day), Number(c));
}
for (const row of basinRows) {
	add(lake, String(row.event), String(row.day), Number(row.c));
}

// Find when ingestion started from the whole table, not this window: a stream
// that stopped and resumed inside the window must fail, not look like a
// fresh start. The first day is partial unless it began at midnight.
const [startRow] = await basin("SELECT min(ts) AS first FROM analytics.events");
const firstTs = startRow?.first ? new Date(String(startRow.first)) : undefined;
if (!firstTs || Number.isNaN(firstTs.getTime())) {
	console.error("analytics.events has no rows: the stream isn't receiving data.");
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

	if (POSTHOG_ONLY.has(event) || BASIN_ONLY.has(event)) {
		lines.push({
			event,
			posthog: p,
			basin: b,
			status: POSTHOG_ONLY.has(event)
				? "PostHog only (not migrated)"
				: "Basin only",
			failing_days: "",
		});
		continue;
	}

	// Browser events may read higher in Basin; server events must match.
	const browser = !event.includes(".");
	const failing = days.filter((day) => {
		const pd = count(ph, event, day);
		const bd = count(lake, event, day);
		return browser ? bd < pd - allowed(pd) : Math.abs(bd - pd) > allowed(pd);
	});

	let status: string;
	if (failing.length > 0) {
		status = browser ? "LOW" : "DRIFT";
		failed = true;
	} else if (browser && b > p + allowed(p)) {
		status = `ok (+${(((b - p) / Math.max(p, 1)) * 100).toFixed(0)}% blockers/early capture)`;
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

// Sign-in: is the PostHog funnel inflated by prefetches or bots?
const signIn = await basin(`
	SELECT is_bot, device, count(*) AS c
	FROM analytics.events
	WHERE ts >= CAST('${days[0]}T00:00:00Z' AS TIMESTAMP)
		AND ts < CAST('${toIso}' AS TIMESTAMP)
		AND event = '${SIGN_IN_INITIATED}'
	GROUP BY 1, 2
	ORDER BY c DESC`);
const humans = signIn
	.filter((row) => row.is_bot === false || row.is_bot === "false")
	.reduce((sum, row) => sum + Number(row.c), 0);
const completed = total(lake, SIGN_IN_COMPLETED);
console.log("\nSign-in initiated, by bot classification and device:");
console.table(signIn);
console.log(
	`Human sign-in starts: ${humans}, completions: ${completed} (${humans ? ((completed / humans) * 100).toFixed(1) : "–"}%). PostHog starts over the same days: ${total(ph, SIGN_IN_INITIATED)}.`,
);

process.exit(failed ? 1 : 0);
