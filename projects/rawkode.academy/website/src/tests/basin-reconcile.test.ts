import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ basin: vi.fn() }));
vi.mock("@/server/basin", () => ({ basinQuery: mocks.basin }));

const event = "rawkode-link.shortLink";
const run = () =>
	import("../../../../rawkode.tools/observability-collector/basin/reconcile");

describe("CloudEvent reconciliation", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-11-13T12:00:00Z"));
		vi.stubEnv("DAYS", "2");
		for (const name of [
			"CLOUDFLARE_ACCOUNT_ID",
			"BASIN_SQL_TOKEN",
			"POSTHOG_PROJECT_ID",
			"POSTHOG_PERSONAL_API_KEY",
		])
			vi.stubEnv(name, "test");
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "table").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(process, "exit").mockImplementation((code) => {
			throw new Error(`exit:${code}`);
		});
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				Response.json({
					results: [
						["2026-11-11", event, 100],
						["2026-11-12", event, 100],
					],
				}),
			),
		);
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		vi.useRealTimers();
	});

	function lake(counts: [number, number]) {
		mocks.basin
			.mockResolvedValueOnce([
				{ day: "2026-11-11", event, c: counts[0] },
				{ day: "2026-11-12", event, c: counts[1] },
			])
			.mockResolvedValueOnce([{ first: "2026-11-07T20:40:55Z" }]);
	}

	it("passes matching UTC days and selects the same CloudEvent population", async () => {
		lake([100, 100]);
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
		expect(mocks.basin.mock.calls[0]?.[1]).toContain("event_time");
		expect(mocks.basin.mock.calls[1]?.[1]).toContain("min(__ingest_ts)");
	});

	it("fails daily drift even when window totals match", async () => {
		lake([150, 50]);
		await expect(run()).rejects.toThrow("exit:1");
	});

	it("fails a missing Basin day", async () => {
		lake([100, 0]);
		await expect(run()).rejects.toThrow("exit:1");
	});

	it("rejects invalid day ranges before querying", async () => {
		vi.stubEnv("DAYS", "NaN");
		await expect(run()).rejects.toThrow("DAYS must be an integer");
		expect(fetch).not.toHaveBeenCalled();
	});
});
