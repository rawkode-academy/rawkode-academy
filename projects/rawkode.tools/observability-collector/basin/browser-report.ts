// Read-only archive-to-typed validation. No replay, backfill or cutover action.
import { writeFile } from "node:fs/promises";
import { basinQuery } from "../../../rawkode.academy/website/src/server/basin";
import {
	browserParityPassed,
	browserQueries,
	browserWindow,
} from "./browser-queries";

function required(name: string) {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set`);
	return value;
}
const start = required("BROWSER_START"),
	end = required("BROWSER_END");
const window = browserWindow(start, end);
if (Date.parse(window.end) > Date.now() - 6 * 3_600_000)
	throw new Error(
		"Browser window must end at least six hours ago for sink settlement",
	);
const config = {
	accountId: required("CLOUDFLARE_ACCOUNT_ID"),
	bucket: "rawkode-analytics",
	token: required("BASIN_SQL_TOKEN"),
};
const queries = browserQueries(start, end);
try {
	const wholeWindow = await basinQuery(config, queries.parity);
	// Validate every day separately: busy days cannot hide a missing day.
	const days = [];
	for (
		let date = Date.parse(window.start);
		date < Date.parse(window.end);
		date += 86_400_000
	) {
		const from = new Date(date).toISOString().slice(0, 10),
			to = new Date(date + 86_400_000).toISOString().slice(0, 10);
		const rows = await basinQuery(config, browserQueries(from, to).parity);
		days.push({ day: from, passed: browserParityPassed(rows), evidence: rows });
	}
	const parityPassed =
		browserParityPassed(wholeWindow) && days.every((day) => day.passed);
	const reports: Record<string, unknown> = {};
	// Do not produce a reassuring business report when projection evidence fails.
	if (parityPassed)
		for (const key of ["traffic", "pages", "campaigns"] as const)
			reports[key] = await basinQuery(config, queries[key]);
	const report = {
		generated_at: new Date().toISOString(),
		window,
		table: "analytics.browser_events_v1",
		whole_window_evidence: wholeWindow,
		days,
		projection_parity_passed: parityPassed,
		cutover_ready: false,
		scope:
			"Browser schema-v1 archive-to-typed projected fields only; not producer acceptance, identity linkage, other families or outage/replay evidence",
		reports,
	};
	// Optional file contains event dimensions: keep it private, never overwrite.
	if (process.env.BROWSER_REPORT)
		await writeFile(
			process.env.BROWSER_REPORT,
			JSON.stringify(report, null, 2),
			{ mode: 0o600, flag: "wx" },
		);
	console.log(
		`Browser projection parity: ${parityPassed ? "PASS" : "FAIL"}; days=${days.length}; passing_projection_days=${days.filter((day) => day.passed).length}; cutover_ready=false`,
	);
	process.exitCode = parityPassed ? 0 : 1;
} catch {
	// Never echo API response bodies, credentials, event IDs or user dimensions.
	console.error(
		"Browser report failed: check Basin SQL access, table availability and query compatibility; no healthy evidence recorded",
	);
	process.exitCode = 2;
}
