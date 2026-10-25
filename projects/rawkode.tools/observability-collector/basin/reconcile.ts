// Dual-run reconciliation: daily event counts in PostHog vs analytics.events.
//
//   cuenv task reconcile -e production          # last 7 full days
//   DAYS=14 cuenv task reconcile -e production
//
// Server-side events (`<source>.<type>`, written by both destinations from the
// collector) must agree within TOLERANCE. Browser events should read the same
// or higher in Basin: ad blockers stop posthog-js but not the first-party
// endpoint, and Basin records page views on load rather than after idle.
// Exits 1 when a server event drifts or Basin is missing a day of data.

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

async function basin(query: string): Promise<Record<string, unknown>[]> {
	const response = await fetch(
		`https://api.sql.cloudflarestorage.com/api/v1/accounts/${required("CLOUDFLARE_ACCOUNT_ID")}/basin-sql/query/${process.env.BASIN_BUCKET ?? "rawkode-analytics"}`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${required("BASIN_SQL_TOKEN")}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query }),
		},
	);
	const payload = (await response.json().catch(() => null)) as {
		result?: { rows?: unknown[]; schema?: Array<{ name: string } | string> };
	} | null;
	if (!response.ok) {
		throw new Error(`Basin SQL ${response.status}: ${JSON.stringify(payload)}`);
	}
	const rows = payload?.result?.rows ?? [];
	if (rows.length === 0 || !Array.isArray(rows[0])) {
		return rows as Record<string, unknown>[];
	}
	const columns = (payload?.result?.schema ?? []).map((c) =>
		typeof c === "string" ? c : c.name,
	);
	return (rows as unknown[][]).map((values) =>
		Object.fromEntries(values.map((v, i) => [columns[i], v])),
	);
}

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

// Compare only full days after the stream started receiving data.
const basinDays = [...lake.values()].flatMap((days) => [...days.keys()]).sort();
const firstFullDay = basinDays[0];
if (!firstFullDay) {
	console.error(`No rows in analytics.events between ${fromIso} and ${toIso}.`);
	process.exit(1);
}
const days: string[] = [];
for (let d = new Date(`${firstFullDay}T00:00:00Z`); d < to; ) {
	d.setUTCDate(d.getUTCDate() + 1);
	if (d < to) days.push(d.toISOString().slice(0, 10));
}
if (days.length === 0) {
	console.log(`Basin data starts ${firstFullDay}; no full day to compare yet.`);
	process.exit(0);
}

const total = (counts: Counts, event: string) =>
	days.reduce((sum, day) => sum + (counts.get(event)?.get(day) ?? 0), 0);

type Line = { event: string; posthog: number; basin: number; status: string };
const lines: Line[] = [];
let failed = false;

const events = new Set([...ph.keys(), ...lake.keys()]);
for (const event of [...events].sort()) {
	const p = total(ph, event);
	const b = total(lake, event);
	if (p === 0 && b === 0) continue;

	let status: string;
	if (POSTHOG_ONLY.has(event)) {
		status = "PostHog only (not migrated)";
	} else if (BASIN_ONLY.has(event)) {
		status = "Basin only";
	} else if (!event.includes(".")) {
		// Browser event: Basin should match or exceed PostHog.
		status =
			b >= p * (1 - TOLERANCE)
				? b > p * (1 + TOLERANCE)
					? `ok (+${(((b - p) / Math.max(p, 1)) * 100).toFixed(0)}% blockers/early capture)`
					: "ok"
				: "LOW";
	} else {
		const drift = Math.abs(b - p) / Math.max(p, 1);
		status = drift <= TOLERANCE ? "ok" : `DRIFT ${(drift * 100).toFixed(1)}%`;
	}
	if (status === "LOW" || status.startsWith("DRIFT")) failed = true;
	lines.push({ event, posthog: p, basin: b, status });
}

const missingDays = days.filter(
	(day) => ![...lake.values()].some((counts) => (counts.get(day) ?? 0) > 0),
);
if (missingDays.length > 0) failed = true;

console.log(`Reconciling ${days[0]} to ${days.at(-1)} (${days.length} full days)\n`);
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
