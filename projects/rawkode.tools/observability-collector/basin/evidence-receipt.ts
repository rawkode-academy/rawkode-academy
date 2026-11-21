// Only this allowlisted aggregate view may be written to CI logs.
const DAY = 86_400_000;
const COUNTERS = [
	"posthog",
	"basin",
	"repeatedPosthog",
	"repeatedBasin",
	"missingInBasin",
	"missingInPosthog",
	"mismatchedEvents",
	"conflictingIdentities",
	"crossDayIdentities",
] as const;
const GAPS = [
	"missingInBasin",
	"missingInPosthog",
	"mismatchedEvents",
	"conflictingIdentities",
	"crossDayIdentities",
] as const;
function object(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw Error("Invalid parity receipt");
	return value as Record<string, unknown>;
}
function count(value: unknown): number {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
		throw Error("Invalid parity receipt");
	return value;
}
function timestamp(value: unknown) {
	if (
		typeof value !== "string" ||
		!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
	)
		throw Error("Invalid parity receipt");
	const date = Date.parse(value);
	if (!Number.isFinite(date) || new Date(date).toISOString() !== value)
		throw Error("Invalid parity receipt");
	return date;
}
export function evidenceSummary(
	input: unknown,
	exitCode: number,
	now = Date.now(),
) {
	const receipt = object(input),
		window = object(receipt.window);
	if (
		receipt.schema_version !== 1 ||
		receipt.scope !== "collector-cloud-event-id-parity" ||
		receipt.cutover_ready !== false ||
		window.settle_hours !== 6
	)
		throw Error("Invalid parity receipt");
	const generated = timestamp(receipt.generated_at),
		from = timestamp(window.from),
		to = timestamp(window.to);
	const expectedEnd = Math.floor((generated - 6 * 3_600_000) / DAY) * DAY;
	if (
		generated > now + 60_000 ||
		now - generated > 15 * 60_000 ||
		to !== expectedEnd ||
		from !== to - DAY ||
		timestamp(window.ingestion_started) > generated
	)
		throw Error("Invalid parity receipt");
	if (!Array.isArray(receipt.days) || receipt.days.length > 1)
		throw Error("Invalid parity receipt");
	const days = receipt.days.map((value) => {
		const row = object(value);
		if (
			row.day !== new Date(from).toISOString().slice(0, 10) ||
			typeof row.passed !== "boolean" ||
			!Array.isArray(row.sources) ||
			row.sources.length > 1024
		)
			throw Error("Invalid parity receipt");
		const counters = Object.fromEntries(
			COUNTERS.map((key) => [key, count(row[key])]),
		) as Record<(typeof COUNTERS)[number], number>;
		const sources = new Set<string>();
		let posthog = 0,
			basin = 0;
		for (const value of row.sources) {
			const source = object(value);
			if (
				typeof source.source !== "string" ||
				!source.source ||
				sources.has(source.source)
			)
				throw Error("Invalid parity receipt");
			sources.add(source.source);
			posthog += count(source.posthog);
			basin += count(source.basin);
		}
		if (posthog !== counters.posthog || basin !== counters.basin)
			throw Error("Invalid parity receipt");
		const passed =
			counters.posthog > 0 &&
			counters.basin > 0 &&
			counters.posthog === counters.basin &&
			GAPS.every((key) => counters[key] === 0);
		if (row.passed !== passed) throw Error("Invalid parity receipt");
		// Never include source strings, event IDs, raw provider output or unknown fields.
		return { day: row.day, ...counters, source_count: sources.size, passed };
	});
	const status =
		days.length === 0
			? "insufficient_data"
			: days.every((day) => day.passed)
				? "passed"
				: "failed";
	if (
		receipt.status !== status ||
		exitCode !== (status === "passed" ? 0 : status === "failed" ? 1 : 2)
	)
		throw Error("Invalid parity receipt");
	return {
		schema_version: 1,
		scope: "collector-cloud-event-id-parity",
		generated_at: receipt.generated_at,
		window: { from: window.from, to: window.to, settle_hours: 6 },
		status,
		days,
		cutover_ready: false,
		limitations:
			"ID/type parity only; not producer acceptance, payload equality, family completeness, identity linkage, reporting or operational telemetry",
	};
}
export function evidenceContext(env: Record<string, string | undefined>) {
	if (
		env.GITHUB_REPOSITORY !== "rawkode-academy/rawkode-academy" ||
		env.GITHUB_REF !== "refs/heads/main" ||
		!["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME ?? "") ||
		!/^[0-9a-f]{40}$/.test(env.GITHUB_SHA ?? "") ||
		!/^\d+$/.test(env.GITHUB_RUN_ID ?? "")
	)
		throw Error("Evidence requires a main-branch scheduled/manual CI run");
	return {
		source_commit: env.GITHUB_SHA,
		workflow_run: `https://github.com/rawkode-academy/rawkode-academy/actions/runs/${env.GITHUB_RUN_ID}`,
	};
}
