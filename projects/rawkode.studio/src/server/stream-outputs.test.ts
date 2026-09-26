import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioEnv, StudioUser } from "../env";

const studioMocks = vi.hoisted(() => ({
	getStudioSession: vi.fn(),
	getStudioUserId: vi.fn(() => "operator"),
	userCanManageStudioSession: vi.fn(),
}));

vi.mock("./studio", () => studioMocks);

import {
	createStreamOutputDestination,
	getStreamOutputState,
	provisionStreamOutputInput,
	StreamOutputError,
	validateOutputTarget,
} from "./stream-outputs";

const user: StudioUser = {
	email: "operator@example.com",
	id: "operator",
	image: null,
	name: "Operator",
	username: "operator",
};

const session = {
	id: "session-1",
	title: "Live show",
};

function dbWithInput(row: unknown): D1Database {
	return {
		prepare: vi.fn(() => ({
			bind: vi.fn(() => ({ first: vi.fn(async () => row) })),
		})),
	} as unknown as D1Database;
}

function provisioningDb(options: { throwAfterFinalize?: boolean } = {}) {
	let row: any = null;
	const db = {
		prepare: vi.fn((sql: string) => ({
			bind: (...values: any[]) => ({
				first: async () => row,
				run: async () => {
					if (sql.includes("INSERT INTO studio_stream_output_inputs")) {
						if (row) return { meta: { changes: 0 } };
						row = {
							claim_token: values[1],
							claimed_at: values[2],
							cloudflare_live_input_id: null,
							provision_state: "provisioning",
						};
						return { meta: { changes: 1 } };
					}
					if (sql.includes("SET cloudflare_live_input_id = ?")) {
						row.cloudflare_live_input_id = values[0];
						return { meta: { changes: 1 } };
					}
					if (sql.includes("SET provision_state = 'ready'")) {
						row.provision_state = "ready";
						if (options.throwAfterFinalize) throw new Error("lost D1 response");
						return { meta: { changes: 1 } };
					}
					if (sql.includes("SET provision_state = 'uncertain'")) {
						row.provision_state = "uncertain";
						return { meta: { changes: 1 } };
					}
					if (sql.includes("DELETE FROM studio_stream_output_inputs")) {
						row = null;
						return { meta: { changes: 1 } };
					}
					return { meta: { changes: 1 } };
				},
			}),
		})),
	} as unknown as D1Database;
	return { db, getRow: () => row };
}

beforeEach(() => {
	studioMocks.getStudioSession.mockResolvedValue(session);
	studioMocks.userCanManageStudioSession.mockResolvedValue(true);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("Studio stream output authorization and readiness", () => {
	it("rejects users without session management access before provider access", async () => {
		studioMocks.userCanManageStudioSession.mockResolvedValue(false);
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			getStreamOutputState(
				{ STUDIO_DB: dbWithInput(null) } as StudioEnv,
				user,
				"session-1",
			),
		).rejects.toMatchObject({ code: "unauthorized", status: 403 });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("reports WHIP limitations and does not pretend outputs are available", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const state = await getStreamOutputState(
			{
				CLOUDFLARE_ACCOUNT_ID: "account-1",
				CLOUDFLARE_STREAM_API_TOKEN: "secret-token",
				STUDIO_DB: dbWithInput(null),
			} as StudioEnv,
			user,
			"session-1",
		);

		expect(state.destinations).toEqual([]);
		expect(state.readiness).toMatchObject({
			inputMode: "whip",
			managedOutputsReady: false,
			maxDestinations: 0,
			programmeDelivery: "browser-whip",
		});
		expect(state.readiness.whipLimitations).toEqual(expect.arrayContaining([
			"Recording and live HLS/DASH playback are unavailable.",
			"Simulcasting or restreaming via RTMP/SRT is unavailable.",
		]));
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("Cloudflare managed output adapter", () => {
	it("allows only public RTMP/RTMPS targets with a separate stream key", () => {
		expect(validateOutputTarget("rtmps://a.rtmp.youtube.com/live2", "key-1"))
			.toEqual({ url: "rtmps://a.rtmp.youtube.com/live2", streamKey: "key-1" });
		for (const url of [
			"https://example.com/live",
			"rtmp://127.0.0.1/live",
			"rtmp://10.0.0.2/live",
			"rtmp://key@example.com/live",
			"rtmp://example.com/live?key=secret",
		]) {
			expect(() => validateOutputTarget(url, "key-1")).toThrow(StreamOutputError);
		}
	});

	it("creates destinations disabled and never returns the provider stream key", async () => {
		const providerKey = "provider-echoed-secret";
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			expect(String(input)).toBe(
				"https://api.cloudflare.com/client/v4/accounts/account-1/stream/live_inputs/input-1/outputs",
			);
			expect(init?.method).toBe("POST");
			expect(init?.headers).toMatchObject({ Authorization: "Bearer secret-token" });
			expect(JSON.parse(String(init?.body))).toEqual({
				enabled: false,
				streamKey: "destination-secret",
				url: "rtmps://example.com/live",
			});
			return Response.json({
				success: true,
				result: {
					enabled: false,
					streamKey: providerKey,
					uid: "0123456789abcdef0123456789abcdef",
					url: "rtmps://example.com/live",
				},
			});
		});
		vi.stubGlobal("fetch", fetchMock);
		const destination = await createStreamOutputDestination(
			{
				CLOUDFLARE_ACCOUNT_ID: "account-1",
				CLOUDFLARE_STREAM_API_TOKEN: "secret-token",
				STUDIO_DB: dbWithInput({
					claim_token: "claim",
					claimed_at: 1,
					cloudflare_live_input_id: "input-1",
					provision_state: "ready",
				}),
			} as StudioEnv,
			user,
			{
				sessionId: "session-1",
				streamKey: "destination-secret",
				url: "rtmps://example.com/live",
			},
		);

		expect(destination).toEqual({
			enabled: false,
			uid: "0123456789abcdef0123456789abcdef",
			url: "rtmps://example.com",
		});
		expect(JSON.stringify(destination)).not.toContain(providerKey);
	});

	it("removes credentials and paths from provider output URLs", async () => {
		const reflectedSecret = "secret-in-provider-url";
		vi.stubGlobal("fetch", vi.fn(async () => Response.json({
			success: true,
			result: {
				enabled: true,
				uid: "0123456789abcdef0123456789abcdef",
				url: `rtmps://user:${reflectedSecret}@example.com/live/${reflectedSecret}?token=${reflectedSecret}`,
			},
		})));
		const destination = await createStreamOutputDestination(
			{
				CLOUDFLARE_ACCOUNT_ID: "account-1",
				CLOUDFLARE_STREAM_API_TOKEN: "secret-token",
				STUDIO_DB: dbWithInput({
					claim_token: "claim",
					claimed_at: 1,
					cloudflare_live_input_id: "input-1",
					provision_state: "ready",
				}),
			} as StudioEnv,
			user,
			{ sessionId: "session-1", streamKey: "destination-secret", url: "rtmps://example.com/live" },
		);
		expect(destination.url).toBe("rtmps://example.com");
		expect(JSON.stringify(destination)).not.toContain(reflectedSecret);
	});

	it("does not expose provider error bodies that may contain credentials", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response(
			JSON.stringify({ errors: [{ message: "bad secret destination-secret" }], success: false }),
			{ status: 400 },
		)));
		const promise = createStreamOutputDestination(
			{
				CLOUDFLARE_ACCOUNT_ID: "account-1",
				CLOUDFLARE_STREAM_API_TOKEN: "secret-token",
				STUDIO_DB: dbWithInput({
					claim_token: "claim",
					claimed_at: 1,
					cloudflare_live_input_id: "input-1",
					provision_state: "ready",
				}),
			} as StudioEnv,
			user,
			{ sessionId: "session-1", streamKey: "destination-secret", url: "rtmp://example.com/live" },
		);
		await expect(promise).rejects.toMatchObject({ code: "provider-failed", status: 502 });
		await expect(promise).rejects.not.toThrow(/destination-secret/);
	});
});

describe("RTMPS/SRT output input provisioning", () => {
	it("persists the dedicated input and keeps credentials out of normal state", async () => {
		const store = provisioningDb();
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			if (init?.method === "POST") {
				return Response.json({
					success: true,
					result: {
						rtmps: { streamKey: "rtmps-secret", url: "rtmps://live.cloudflare.com/live" },
						srt: { passphrase: "srt-secret", streamId: "stream-1", url: "srt://live.cloudflare.com:778" },
						uid: "input-1",
					},
				});
			}
			expect(String(input)).toContain("/stream/live_inputs/input-1/outputs");
			return Response.json({ success: true, result: [] });
		});
		vi.stubGlobal("fetch", fetchMock);
		const result = await provisionStreamOutputInput(
			{
				CLOUDFLARE_ACCOUNT_ID: "account-1",
				CLOUDFLARE_STREAM_API_TOKEN: "secret-token",
				STUDIO_DB: store.db,
			} as StudioEnv,
			user,
			"session-1",
		);
		expect(store.getRow()).toMatchObject({
			cloudflare_live_input_id: "input-1",
			provision_state: "ready",
		});
		expect(result.credentials.rtmps.streamKey).toBe("rtmps-secret");
		expect(result.state.readiness.outputInputState).toBe("ready");
		expect(JSON.stringify(result.state)).not.toContain("rtmps-secret");
		expect(JSON.stringify(result.state)).not.toContain("srt-secret");
	});

	it("fails closed after an unknown create outcome instead of creating duplicates", async () => {
		const store = provisioningDb();
		const fetchMock = vi.fn(async () => {
			throw new TypeError("network response lost");
		});
		vi.stubGlobal("fetch", fetchMock);
		const env = {
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "secret-token",
			STUDIO_DB: store.db,
		} as StudioEnv;

		await expect(provisionStreamOutputInput(env, user, "session-1"))
			.rejects.toMatchObject({ code: "provider-failed" });
		expect(store.getRow()).toMatchObject({ provision_state: "uncertain" });
		await expect(provisionStreamOutputInput(env, user, "session-1"))
			.rejects.toMatchObject({ code: "conflict" });
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it("does not compensate a provider input after an ambiguous committed finalize", async () => {
		const store = provisioningDb({ throwAfterFinalize: true });
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			expect(init?.method).not.toBe("DELETE");
			return Response.json({
				success: true,
				result: {
					rtmps: { streamKey: "rtmps-secret", url: "rtmps://live.cloudflare.com/live" },
					srt: { passphrase: "srt-secret", streamId: "stream-1", url: "srt://live.cloudflare.com:778" },
					uid: "input-1",
				},
			});
		});
		vi.stubGlobal("fetch", fetchMock);
		await expect(provisionStreamOutputInput(
			{
				CLOUDFLARE_ACCOUNT_ID: "account-1",
				CLOUDFLARE_STREAM_API_TOKEN: "secret-token",
				STUDIO_DB: store.db,
			} as StudioEnv,
			user,
			"session-1",
		)).rejects.toThrow("lost D1 response");
		expect(store.getRow()).toMatchObject({
			cloudflare_live_input_id: "input-1",
			provision_state: "ready",
		});
		expect(fetchMock).toHaveBeenCalledOnce();
	});
});
