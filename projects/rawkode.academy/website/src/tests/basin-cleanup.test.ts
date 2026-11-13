import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ infrastructure: "" }));
// The script sits outside the website's Vite root, so vitest reaches its
// named import through the module's default export: mock both.
vi.mock("node:fs/promises", () => {
	const readFile = vi.fn(() => Promise.resolve(mocks.infrastructure));
	return { default: { readFile }, readFile };
});

const live = ["events_archive", "short_links"];
let current: string[];
let metadata: Record<string, unknown>;
let maintenanceEnabled: boolean;
const run = () =>
	import(
		"../../../../rawkode.tools/observability-collector/basin/drop-legacy-table"
	);

describe("legacy table purge guards", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubEnv("BASIN_CATALOG_TOKEN", "test-token");
		vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "0aeb879de8e3cdde5fb3d413025222ce");
		vi.spyOn(console, "log").mockImplementation(() => {});
		current = ["events", ...live];
		mocks.infrastructure =
			'config: table_name: "events_archive"\nconfig: table_name: "short_links"';
		metadata = {};
		maintenanceEnabled = true;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string, init: RequestInit) => {
				if (init.method === "DELETE") {
					current = [...live];
					return new Response(null, { status: 204 });
				}
				if (url.endsWith("maintenance-configs"))
					return Response.json({
						result: {
							maintenance_config: {
								compaction: {
									state: maintenanceEnabled ? "enabled" : "disabled",
								},
								snapshot_expiration: { state: "enabled" },
							},
						},
					});
				if (url.endsWith("/events")) return Response.json({ metadata });
				return Response.json({
					identifiers: current.map((name) => ({
						namespace: ["analytics"],
						name,
					})),
				});
			}),
		);
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});
	const deletes = () =>
		vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "DELETE");

	it("purges only the empty legacy table, then verifies survivors", async () => {
		await run();
		expect(deletes()).toHaveLength(1);
		expect(deletes()[0]?.[0]).toMatch(
			/\/v1\/namespaces\/analytics\/tables\/events\?purgeRequested=true$/,
		);
		expect(current).toEqual(live);
		expect(
			vi
				.mocked(fetch)
				.mock.calls.filter(([url]) =>
					String(url).endsWith("maintenance-configs"),
				),
		).toHaveLength(4);
		expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain(
			"test-token",
		);
	});

	it("refuses a table containing records", async () => {
		metadata = {
			"current-snapshot-id": 1,
			snapshots: [{ "snapshot-id": 1, summary: { "total-records": "12" } }],
		};
		await expect(run()).rejects.toThrow("not proven empty");
		expect(deletes()).toHaveLength(0);
	});

	it("refuses unknown tables and disabled maintenance", async () => {
		current.push("unexpected");
		await expect(run()).rejects.toThrow("Unexpected tables");
		expect(deletes()).toHaveLength(0);
	});

	it("refuses a sink that still names the legacy table", async () => {
		mocks.infrastructure =
			'config: table_name: "events"\nconfig: table_name: "short_links"';
		await expect(run()).rejects.toThrow("Sink table declarations changed");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("refuses disabled maintenance", async () => {
		maintenanceEnabled = false;
		await expect(run()).rejects.toThrow("not enabled");
		expect(deletes()).toHaveLength(0);
	});

	it("is safe to rerun after the legacy table is absent", async () => {
		current = [...live];
		await run();
		expect(deletes()).toHaveLength(0);
	});
});
