// @vitest-environment node
import { mkdtemp, readFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ basin: vi.fn() }));
vi.mock("@/server/basin", () => ({ basinQuery: mocks.basin }));
const run = () =>
	import("../../../../rawkode.tools/observability-collector/basin/reconcile");
const source = "rawkode-link",
	event = "rawkode-link.shortLink";
const dayRow = (day: string, id = `${day}-1`, copies = 1) => ({
	source,
	event_id: id,
	event,
	copies,
	versions: 1,
});

function data(
	lake: Record<string, ReturnType<typeof dayRow>[]>,
	ph?: Record<string, ReturnType<typeof dayRow>[]>,
) {
	mocks.basin.mockImplementation(async (_config, query: string) => {
		if (query.includes("min(__ingest_ts)"))
			return [{ first: "2026-11-07T20:40:55Z" }];
		return (
			lake[query.match(/event_time >= CAST\('2026-11-(\d{2})/)?.[1] ?? ""] ?? []
		);
	});
	vi.stubGlobal(
		"fetch",
		vi.fn(async (_url, init: RequestInit) => {
			const query = JSON.parse(init.body as string).query.query as string;
			const rows =
				(ph ?? lake)[
					query.match(/timestamp >= toDateTime\('2026-11-(\d{2})/)?.[1] ?? ""
				] ?? [];
			return Response.json({
				results: rows.map((row) => [
					row.source,
					row.event_id,
					row.event,
					row.copies,
					row.versions,
				]),
			});
		}),
	);
}

describe("CloudEvent ID reconciliation", () => {
	beforeEach(() => {
		vi.resetModules();
		mocks.basin.mockReset();
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-11-13T12:00:00Z"));
		vi.stubEnv("DAYS", "2");
		vi.stubEnv("RECONCILE_REPORT", "");
		vi.stubEnv("SETTLE_HOURS", "6");
		for (const name of [
			"CLOUDFLARE_ACCOUNT_ID",
			"BASIN_SQL_TOKEN",
			"POSTHOG_PROJECT_ID",
			"POSTHOG_PERSONAL_API_KEY",
		])
			vi.stubEnv(name, "test");
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "table").mockImplementation(() => {});
		vi.spyOn(process, "exit").mockImplementation((code) => {
			throw new Error(`exit:${code}`);
		});
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		vi.useRealTimers();
	});

	it("passes exact identities over settled full UTC days", async () => {
		data({ "11": [dayRow("11")], "12": [dayRow("12")] });
		await expect(run()).rejects.toThrow("exit:0");
		const request = JSON.parse(
			vi.mocked(fetch).mock.calls[0]?.[1]?.body as string,
		);
		expect(request.query.query).toContain(
			"properties.$lib = 'observability-collector'",
		);
		expect(request.query.query).toContain(
			"properties.cloudevents_id IS NOT NULL",
		);
		expect(request.query.query).toContain("LIMIT 1000");
		expect(mocks.basin.mock.calls[0]?.[1]).toContain("min(__ingest_ts)");
		const report = JSON.parse(
			vi.mocked(console.log).mock.calls[0]?.[0] as string,
		);
		expect(report).toMatchObject({
			status: "passed",
			cutover_ready: false,
			scope: "collector-cloud-event-id-parity",
		});
	});
	it("fails equal totals with different IDs", async () => {
		data(
			{ "11": [dayRow("11", "wrong-id")], "12": [dayRow("12")] },
			{ "11": [dayRow("11")], "12": [dayRow("12")] },
		);
		await expect(run()).rejects.toThrow("exit:1");
	});
	it("does not inflate identity counts for retries", async () => {
		data(
			{
				"11": [dayRow("11", undefined, 3)],
				"12": [dayRow("12", undefined, 2)],
			},
			{ "11": [dayRow("11")], "12": [dayRow("12")] },
		);
		await expect(run()).rejects.toThrow("exit:0");
	});
	it("fails a missing Basin day", async () => {
		data(
			{ "11": [dayRow("11")], "12": [] },
			{ "11": [dayRow("11")], "12": [dayRow("12")] },
		);
		await expect(run()).rejects.toThrow("exit:1");
	});
	it("fails identities reused on different days", async () => {
		data({ "11": [dayRow("11", "reused")], "12": [dayRow("12", "reused")] });
		await expect(run()).rejects.toThrow("exit:1");
	});
	it("defers the most recent UTC day during the settlement grace period", async () => {
		vi.setSystemTime(new Date("2026-11-13T03:00:00Z"));
		data({ "11": [dayRow("11")], "10": [dayRow("10")] });
		await expect(run()).rejects.toThrow("exit:0");
		const report = JSON.parse(
			vi.mocked(console.log).mock.calls[0]?.[0] as string,
		);
		expect(report.window.to).toBe("2026-11-12T00:00:00.000Z");
	});

	it("rejects a provider-truncated page instead of certifying partial IDs", async () => {
		data({ "11": [dayRow("11")], "12": [dayRow("12")] });
		vi.mocked(fetch).mockResolvedValueOnce(
			Response.json({ results: [[source, "one", event, 1, 1]], hasMore: true }),
		);
		await expect(run()).rejects.toThrow("truncated an identity page");
	});

	it("writes a private timestamped receipt without claiming cutover readiness", async () => {
		const directory = await mkdtemp(join(tmpdir(), "academy-parity-"));
		const filename = join(directory, "receipt.json");
		vi.stubEnv("RECONCILE_REPORT", filename);
		data({ "11": [dayRow("11")], "12": [dayRow("12")] });
		try {
			await expect(run()).rejects.toThrow("exit:0");
			const report = JSON.parse(await readFile(filename, "utf8"));
			expect(report).toMatchObject({
				generated_at: "2026-11-13T12:00:00.000Z",
				status: "passed",
				cutover_ready: false,
			});
			expect((await stat(filename)).mode & 0o777).toBe(0o600);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it("rejects invalid day ranges before querying", async () => {
		vi.stubEnv("DAYS", "NaN");
		await expect(run()).rejects.toThrow("DAYS must be an integer");
		expect(mocks.basin).not.toHaveBeenCalled();
	});
	it("returns insufficient data for an archive with no full settled day", async () => {
		mocks.basin.mockResolvedValue([{ first: "2026-11-13T01:00:00Z" }]);
		await expect(run()).rejects.toThrow("exit:2");
	});
});
