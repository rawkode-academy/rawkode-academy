import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	addRealtimeKitParticipant,
	createLegacyRealtimeKitCustomParticipantId,
	createRealtimeKitCustomParticipantId,
	findRealtimeKitParticipantByCustomId,
	getRealtimeKitConfig,
	RealtimeKitProviderError,
	refreshRealtimeKitParticipantToken,
	type RealtimeKitConfig,
} from "./realtimekit";

afterEach(() => {
	vi.unstubAllGlobals();
});

const config: RealtimeKitConfig = {
	accountId: "account-1",
	apiToken: "runtime-secret-token",
	appId: "app-1",
	presets: {
		guest: "guest-preset",
		host: "host-preset",
		producer: "producer-preset",
		program: "program-preset",
	},
};

describe("RealtimeKit configuration", () => {
	it("resolves API credentials from Cloudflare Secrets Store bindings", async () => {
		const getApiToken = vi.fn(async () => "  realtimekit-token  ");
		const getAppId = vi.fn(async () => "  realtimekit-app  ");

		const config = await getRealtimeKitConfig({
			CLOUDFLARE_ACCOUNT_ID: "  account-id  ",
			REALTIMEKIT_API_TOKEN: { get: getApiToken },
			REALTIMEKIT_APP_ID: { get: getAppId },
			REALTIMEKIT_GUEST_PRESET: "studio-guest",
			REALTIMEKIT_HOST_PRESET: "studio-host",
			REALTIMEKIT_PRODUCER_PRESET: "studio-producer",
			REALTIMEKIT_PROGRAM_PRESET: "studio-program",
		});

		expect(getApiToken).toHaveBeenCalledOnce();
		expect(getAppId).toHaveBeenCalledOnce();
		expect(config).toEqual({
			accountId: "account-id",
			apiToken: "realtimekit-token",
			appId: "realtimekit-app",
			presets: {
				guest: "studio-guest",
				host: "studio-host",
				producer: "studio-producer",
				program: "studio-program",
			},
		});
	});

	it("preserves plain-string credentials for local development", async () => {
		await expect(
			getRealtimeKitConfig({
				CLOUDFLARE_ACCOUNT_ID: "account-id",
				REALTIMEKIT_API_TOKEN: "token",
				REALTIMEKIT_APP_ID: "app-id",
			}),
		).resolves.toEqual({
			accountId: "account-id",
			apiToken: "token",
			appId: "app-id",
			presets: {
				guest: "guest",
				host: "host",
				producer: "producer",
				program: "program",
			},
		});
	});

	it("returns no configuration when a secret resolves empty", async () => {
		await expect(
			getRealtimeKitConfig({
				CLOUDFLARE_ACCOUNT_ID: "account-id",
				REALTIMEKIT_API_TOKEN: { get: async () => "" },
				REALTIMEKIT_APP_ID: { get: async () => "app-id" },
			}),
		).resolves.toBeNull();
	});

	it("returns no configuration when local Secrets Store values are absent", async () => {
		await expect(
			getRealtimeKitConfig({
				CLOUDFLARE_ACCOUNT_ID: "account-id",
				REALTIMEKIT_API_TOKEN: {
					get: async () => Promise.reject(new Error("Secret not found")),
				},
				REALTIMEKIT_APP_ID: {
					get: async () => Promise.reject(new Error("Secret not found")),
				},
			}),
		).resolves.toBeNull();
	});
});

describe("RealtimeKit participant identity", () => {
	it("builds a deterministic, role-readable, opaque meeting participant ID", async () => {
		const input = {
			meetingId: "meeting-1",
			participantId: "rawkode",
			role: "host" as const,
		};
		const first = await createRealtimeKitCustomParticipantId(input);
		const second = await createRealtimeKitCustomParticipantId(input);

		expect(first).toBe(second);
		expect(first).toMatch(/^studio:host:v1:[a-f0-9]{64}$/);
		expect(first).not.toContain("rawkode");
		await expect(
			createRealtimeKitCustomParticipantId({
				...input,
				meetingId: "meeting-2",
			}),
		).resolves.not.toBe(first);
		await expect(
			createRealtimeKitCustomParticipantId({
				...input,
				role: "producer",
			}),
		).resolves.toMatch(/^studio:producer:v1:[a-f0-9]{64}$/);
	});

	it("retains the previous exact ID only for provider reconciliation", () => {
		expect(
			createLegacyRealtimeKitCustomParticipantId({
				participantId: "rawkode",
				role: "host",
			}),
		).toBe("studio:host:rawkode");
	});
});

describe("RealtimeKit participant provider operations", () => {
	it("adds a participant with the opaque custom identity", async () => {
		const expectedCustomId = await createRealtimeKitCustomParticipantId({
			meetingId: "meeting-1",
			participantId: "rawkode",
			role: "host",
		});
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			expect(String(input)).toBe(
				"https://api.cloudflare.com/client/v4/accounts/account-1/realtime/kit/app-1/meetings/meeting-1/participants",
			);
			expect(init?.method).toBe("POST");
			expect(init?.headers).toMatchObject({
				Authorization: "Bearer runtime-secret-token",
			});
			expect(JSON.parse(String(init?.body))).toEqual({
				custom_participant_id: expectedCustomId,
				name: "Rawkode",
				picture: "https://example.com/rawkode.png",
				preset_name: "host-preset",
			});
			return new Response(
				JSON.stringify({
					data: { id: "provider-participant-1", token: "participant-token-1" },
					success: true,
				}),
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			addRealtimeKitParticipant(config, {
				meetingId: "meeting-1",
				name: "Rawkode",
				participantId: "rawkode",
				picture: "https://example.com/rawkode.png",
				role: "host",
			}),
		).resolves.toEqual({
			participantId: "provider-participant-1",
			token: "participant-token-1",
		});
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it("refreshes an existing participant token using the provider ID", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			expect(String(input)).toBe(
				"https://api.cloudflare.com/client/v4/accounts/account-1/realtime/kit/app-1/meetings/meeting-1/participants/provider-participant-1/token",
			);
			expect(init?.method).toBe("POST");
			return new Response(
				JSON.stringify({
					result: { token: "participant-token-2" },
					success: true,
				}),
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			refreshRealtimeKitParticipantToken(config, {
				meetingId: "meeting-1",
				realtimeKitParticipantId: "provider-participant-1",
			}),
		).resolves.toEqual({
			participantId: "provider-participant-1",
			token: "participant-token-2",
		});
	});

	it("reconciles by exact custom ID across data/result envelope pages", async () => {
		const customParticipantId = await createRealtimeKitCustomParticipantId({
			meetingId: "meeting-1",
			participantId: "rawkode",
			role: "host",
		});
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(String(input));
			const page = url.searchParams.get("page_no");
			if (page === "1") {
				return new Response(
					JSON.stringify({
						data: [
							{
								custom_participant_id: `${customParticipantId}-near-match`,
								id: "wrong-participant",
							},
						],
						paging: { end_offset: 1, start_offset: 0, total_count: 2 },
						success: true,
					}),
				);
			}
			expect(page).toBe("2");
			return new Response(
				JSON.stringify({
					result: [
						{
							custom_participant_id: customParticipantId,
							id: "provider-participant-1",
							name: "Rawkode",
							picture: "https://example.com/rawkode.png",
							preset_name: "host-preset",
						},
					],
					result_info: { page: 2, per_page: 1, total_count: 2, total_pages: 2 },
					success: true,
				}),
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			findRealtimeKitParticipantByCustomId(config, {
				customParticipantId,
				meetingId: "meeting-1",
			}),
		).resolves.toEqual({
			customParticipantId,
			name: "Rawkode",
			participantId: "provider-participant-1",
			picture: "https://example.com/rawkode.png",
			presetName: "host-preset",
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("returns null instead of accepting a partial custom ID match", async () => {
		const fetchMock = vi.fn(async () =>
			new Response(
				JSON.stringify({
					data: [
						{
							custom_participant_id: "studio:host:v1:expected-suffix",
							id: "wrong-participant",
						},
					],
					paging: { end_offset: 1, start_offset: 0, total_count: 1 },
					success: true,
				}),
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			findRealtimeKitParticipantByCustomId(config, {
				customParticipantId: "studio:host:v1:expected",
				meetingId: "meeting-1",
			}),
		).resolves.toBeNull();
	});

	it("bounds pagination when full pages omit pagination metadata", async () => {
		const fullPage = Array.from({ length: 100 }, (_, index) => ({
			custom_participant_id: `other-${index}`,
			id: `participant-${index}`,
		}));
		const fetchMock = vi.fn(async () =>
			new Response(JSON.stringify({ data: fullPage, success: true })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			findRealtimeKitParticipantByCustomId(config, {
				customParticipantId: "missing-participant",
				meetingId: "meeting-1",
			}),
		).resolves.toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(10);
	});

	it("retains safe provider context without response or secret leakage", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				new Response(
					JSON.stringify({
						errors: [
							{
								code: 1015,
								message: "duplicate runtime-secret-token rawkode",
							},
							{
								code: "runtime-secret-token",
								message: "untrusted string codes are not diagnostic metadata",
							},
						],
						success: false,
					}),
					{
						headers: { "cf-ray": "abc123-LHR" },
						status: 429,
					},
				),
			),
		);

		const error = await addRealtimeKitParticipant(config, {
			meetingId: "meeting-1",
			name: "Rawkode",
			participantId: "rawkode",
			role: "host",
		}).catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(RealtimeKitProviderError);
		expect(error).toMatchObject({
			failureKind: "provider",
			httpStatus: 429,
			operation: "add-participant",
			providerCodes: ["1015"],
			rayId: "abc123-LHR",
		});
		expect((error as Error).message).not.toContain("runtime-secret-token");
		expect((error as Error).message).not.toContain("rawkode");
		expect((error as Error).message).not.toContain("duplicate");
	});

	it("wraps network failures without leaking their original message", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Promise.reject(new Error("runtime-secret-token leaked"))),
		);

		const error = await refreshRealtimeKitParticipantToken(config, {
			meetingId: "meeting-1",
			realtimeKitParticipantId: "provider-participant-1",
		}).catch((reason: unknown) => reason);

		expect(error).toMatchObject({
			failureKind: "network",
			httpStatus: null,
			operation: "refresh-participant-token",
			providerCodes: [],
		});
		expect((error as Error).message).not.toContain("runtime-secret-token");
	});
});

describe("RealtimeKit browser bridge", () => {
	it("bundles the mutually compatible 2.0.0 Core and UI Kit runtimes", () => {
		const roomBridge = readFileSync(
			new URL("../components/RealtimeKitRoom.vue", import.meta.url),
			"utf8",
		);
		const studioPackage = JSON.parse(
			readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
		) as { dependencies?: Record<string, string> };

		expect(studioPackage.dependencies).toMatchObject({
			"@cloudflare/realtimekit": "2.0.0",
			"@cloudflare/realtimekit-ui": "2.0.0",
		});
		expect(roomBridge).toContain('from "@cloudflare/realtimekit"');
		expect(roomBridge).toContain('from "@cloudflare/realtimekit-ui/loader"');
		expect(roomBridge).not.toContain("cdn.jsdelivr.net");
		expect(roomBridge).not.toContain("window.RealtimeKitClient");
		expect(roomBridge).not.toContain("loadScript(");
	});

	it("can block joining until the provider meeting is ready", () => {
		const roomBridge = readFileSync(
			new URL("../components/RealtimeKitRoom.vue", import.meta.url),
			"utf8",
		);

		expect(roomBridge).toContain("providerReady?: boolean");
		expect(roomBridge).toContain("props.providerReady !== false");
	});
});
