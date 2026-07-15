import { afterEach, describe, expect, it, vi } from "vitest";
import {
	addRealtimeKitParticipant,
	createRealtimeKitMeeting,
	endRealtimeKitSession,
	getRealtimeKitConfig,
} from "./realtimekit";

async function createConfig() {
	const config = await getRealtimeKitConfig({
		CLOUDFLARE_ACCOUNT_ID: "account-1",
		REALTIMEKIT_API_TOKEN: "token-1",
		REALTIMEKIT_APP_ID: "app-1",
		REALTIMEKIT_HOST_PRESET: "host-preset",
	});
	if (!config) throw new Error("Expected RealtimeKit test configuration");
	return config;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("RealtimeKit API contract", () => {
	it("creates meetings with only the supported title field", async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({
			data: {
				id: "meeting-1",
				record_on_start: false,
				title: "Rawkode Live production room",
			},
			success: true,
		})));
		vi.stubGlobal("fetch", fetchMock);

		await expect(createRealtimeKitMeeting(await createConfig(), {
			title: "Rawkode Live production room",
		})).resolves.toEqual({
			id: "meeting-1",
			recordOnStart: false,
			title: "Rawkode Live production room",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.cloudflare.com/client/v4/accounts/account-1/realtime/kit/app-1/meetings",
			{
				body: JSON.stringify({ title: "Rawkode Live production room" }),
				headers: {
					Authorization: "Bearer token-1",
					"Content-Type": "application/json",
				},
				method: "POST",
			},
		);
	});

	it("adds participants using the current data envelope and request contract", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
			new Response(JSON.stringify(init?.method === "GET"
				? { data: [], success: true }
				: {
					data: { id: "participant-1", token: "participant-token" },
					success: true,
				})),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(addRealtimeKitParticipant(await createConfig(), {
			meetingId: "meeting-1",
			name: "Rawkode",
			participantId: "rawkode",
			picture: "https://example.com/rawkode.png",
			role: "host",
		})).resolves.toEqual({
			customParticipantId: "studio:host:rawkode",
			participantId: "participant-1",
			token: "participant-token",
		});
		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			"https://api.cloudflare.com/client/v4/accounts/account-1/realtime/kit/app-1/meetings/meeting-1/participants?page_no=1&per_page=100",
			{
				headers: {
					Authorization: "Bearer token-1",
					"Content-Type": "application/json",
				},
				method: "GET",
			},
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://api.cloudflare.com/client/v4/accounts/account-1/realtime/kit/app-1/meetings/meeting-1/participants",
			{
				body: JSON.stringify({
					custom_participant_id: "studio:host:rawkode",
					preset_name: "host-preset",
					name: "Rawkode",
					picture: "https://example.com/rawkode.png",
				}),
				headers: {
					Authorization: "Bearer token-1",
					"Content-Type": "application/json",
				},
				method: "POST",
			},
		);
	});

	it("refreshes an existing participant token instead of adding a duplicate", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
			new Response(JSON.stringify(init?.method === "GET"
				? {
					data: [{
						custom_participant_id: "studio:host:opaque-user-1",
						id: "participant-1",
					}],
					success: true,
				}
				: { data: { token: "refreshed-token" }, success: true })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(addRealtimeKitParticipant(await createConfig(), {
			meetingId: "meeting-1",
			name: "Rawkode",
			participantId: "opaque-user-1",
			role: "host",
		})).resolves.toEqual({
			customParticipantId: "studio:host:opaque-user-1",
			participantId: "participant-1",
			token: "refreshed-token",
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://api.cloudflare.com/client/v4/accounts/account-1/realtime/kit/app-1/meetings/meeting-1/participants/participant-1/token",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("reconciles concurrent participant creation by refreshing the winner", async () => {
		let listCount = 0;
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			if (init?.method === "GET") {
				listCount += 1;
				return new Response(JSON.stringify({
					data: listCount === 1
						? []
						: [{
							custom_participant_id: "studio:host:opaque-user-1",
							id: "participant-race-winner",
						}],
					success: true,
				}));
			}
			if (String(_input).endsWith("/token")) {
				return new Response(JSON.stringify({
					data: { token: "race-refreshed-token" },
					success: true,
				}));
			}
			return new Response(JSON.stringify({
				errors: [{ code: 40901 }],
				success: false,
			}), { status: 409 });
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(addRealtimeKitParticipant(await createConfig(), {
			meetingId: "meeting-1",
			name: "Rawkode",
			participantId: "opaque-user-1",
			role: "host",
		})).resolves.toEqual({
			customParticipantId: "studio:host:opaque-user-1",
			participantId: "participant-race-winner",
			token: "race-refreshed-token",
		});
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});

	it("searches subsequent participant pages before creating a participant", async () => {
		const firstPageParticipants = Array.from({ length: 100 }, (_, index) => ({
			custom_participant_id: `studio:guest:other-${index}`,
			id: `participant-other-${index}`,
		}));
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("page_no=1")) {
				return new Response(JSON.stringify({
					data: firstPageParticipants,
					paging: { end_offset: 100, start_offset: 1, total_count: 101 },
					success: true,
				}));
			}
			if (url.includes("page_no=2")) {
				return new Response(JSON.stringify({
					data: [{
						custom_participant_id: "studio:host:opaque-user-1",
						id: "participant-page-2",
					}],
					paging: { end_offset: 101, start_offset: 101, total_count: 101 },
					success: true,
				}));
			}
			return new Response(JSON.stringify({
				data: { token: "page-2-token" },
				success: true,
			}));
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(addRealtimeKitParticipant(await createConfig(), {
			meetingId: "meeting-1",
			name: "Rawkode",
			participantId: "opaque-user-1",
			role: "host",
		})).resolves.toEqual({
			customParticipantId: "studio:host:opaque-user-1",
			participantId: "participant-page-2",
			token: "page-2-token",
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://api.cloudflare.com/client/v4/accounts/account-1/realtime/kit/app-1/meetings/meeting-1/participants?page_no=2&per_page=100",
			expect.objectContaining({ method: "GET" }),
		);
		expect(fetchMock.mock.calls.some(([input]) =>
			String(input).endsWith("/participants")
		)).toBe(false);
	});

	it("prefers a legacy participant identity before the new opaque identity", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
			new Response(JSON.stringify(init?.method === "GET"
				? {
					data: [
						{
							custom_participant_id: "studio:host:opaque-user-1",
							id: "participant-opaque",
						},
						{
							custom_participant_id: "studio:host:rawkode",
							id: "participant-legacy",
						},
					],
					success: true,
				}
				: {
					data: { token: `token-for-${String(input).includes("participant-legacy") ? "legacy" : "opaque"}` },
					success: true,
				})),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(addRealtimeKitParticipant(await createConfig(), {
			customParticipantId: "studio:host:opaque-user-1",
			legacyParticipantId: "rawkode",
			meetingId: "meeting-1",
			name: "Rawkode",
			participantId: "opaque-user-1",
			role: "host",
		})).resolves.toEqual({
			customParticipantId: "studio:host:rawkode",
			participantId: "participant-legacy",
			token: "token-for-legacy",
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://api.cloudflare.com/client/v4/accounts/account-1/realtime/kit/app-1/meetings/meeting-1/participants/participant-legacy/token",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it.each([
		{ data: { id: "", token: "participant-token" }, missing: "id" },
		{ data: { id: "participant-1", token: "" }, missing: "token" },
	])("rejects participant creation when the provider omits $missing", async ({ data }) => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
			new Response(JSON.stringify(init?.method === "GET"
				? { data: [], success: true }
				: { data, success: true })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(addRealtimeKitParticipant(await createConfig(), {
			meetingId: "meeting-1",
			name: "Rawkode",
			participantId: "opaque-user-1",
			role: "host",
		})).rejects.toThrow("RealtimeKit API returned an invalid participant response");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("rejects an invalid refreshed token without creating another participant", async () => {
		const participant = {
			custom_participant_id: "studio:host:opaque-user-1",
			id: "participant-1",
		};
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
			new Response(JSON.stringify(init?.method === "GET"
				? { data: [participant], success: true }
				: { data: { token: "" }, success: true })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(addRealtimeKitParticipant(await createConfig(), {
			meetingId: "meeting-1",
			name: "Rawkode",
			participantId: "opaque-user-1",
			role: "host",
		})).rejects.toThrow("RealtimeKit API returned an invalid token response");
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(fetchMock.mock.calls.filter(([input]) =>
			String(input).endsWith("/participants")
		)).toHaveLength(0);
	});

	it("omits invalid picture URIs from participant creation", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
			new Response(JSON.stringify(init?.method === "GET"
				? { data: [], success: true }
				: { data: { id: "participant-1", token: "participant-token" }, success: true })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await addRealtimeKitParticipant(await createConfig(), {
			meetingId: "meeting-1",
			name: "Rawkode",
			participantId: "opaque-user-1",
			picture: "not a URI",
			role: "host",
		});
		const createInit = fetchMock.mock.calls[1]?.[1];
		const body = JSON.parse(String(createInit?.body ?? "{}")) as Record<string, unknown>;
		expect(body).not.toHaveProperty("picture");
	});

	it("kicks the active session before disabling its meeting", async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({
			data: {},
			success: true,
		})));
		vi.stubGlobal("fetch", fetchMock);

		await expect(endRealtimeKitSession(
			await createConfig(),
			"meeting-1",
		)).resolves.toBeUndefined();
		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			"https://api.cloudflare.com/client/v4/accounts/account-1/realtime/kit/app-1/meetings/meeting-1/active-session/kick-all",
			{
				headers: {
					Authorization: "Bearer token-1",
					"Content-Type": "application/json",
				},
				method: "POST",
			},
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://api.cloudflare.com/client/v4/accounts/account-1/realtime/kit/app-1/meetings/meeting-1",
			{
				body: JSON.stringify({ status: "INACTIVE" }),
				headers: {
					Authorization: "Bearer token-1",
					"Content-Type": "application/json",
				},
				method: "PATCH",
			},
		);
	});

	it("keeps only bounded numeric provider codes in action errors", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
			errors: [
				{ code: -1, message: "negative" },
				{ code: 1.5, message: "decimal" },
				{ code: 10_000_000_000, message: "eleven digits" },
				{
					code: 1001,
					message: "token-1 account-1 app-1 meeting-1 /realtime/kit/app-1/meetings/meeting-1",
				},
				{
					code: "token-1",
					message: "token-1 account-1 app-1 meeting-1 /realtime/kit/app-1/meetings/meeting-1",
				},
				{ code: "account-1", message: "account-1" },
				{ code: "app-1", message: "app-1" },
				{ code: "meeting-1", message: "meeting-1" },
				{
					code: "/realtime/kit/app-1/meetings/meeting-1",
					message: "token-1 account-1 app-1 meeting-1 /realtime/kit/app-1/meetings/meeting-1",
				},
				{ code: "5005", message: "token-1 account-1 app-1 meeting-1" },
			],
			messages: [
				{
					code: 2002,
					message: "token-1 account-1 app-1 meeting-1 /realtime/kit/app-1/meetings/meeting-1",
				},
				{ code: "token-1", message: "token-1" },
				{ code: "account-1", message: "account-1" },
				{ code: "app-1", message: "app-1" },
				{ code: "meeting-1", message: "meeting-1" },
				{
					code: "/realtime/kit/app-1/meetings/meeting-1",
					message: "/realtime/kit/app-1/meetings/meeting-1",
				},
				{
					code: 3003,
					message: "token-1 account-1 app-1 meeting-1 /realtime/kit/app-1/meetings/meeting-1",
				},
				{
					code: 4004,
					message: "token-1 account-1 app-1 meeting-1 /realtime/kit/app-1/meetings/meeting-1",
				},
			],
			success: false,
		}), { status: 400 })));

		const error = await createRealtimeKitMeeting(await createConfig(), {
			title: "Rawkode Live production room",
		}).then(
			() => null,
			(cause: unknown) => cause,
		);
		expect(error).toBeInstanceOf(Error);
		const message = (error as Error).message;
		expect(message).toBe(
			"RealtimeKit API returned 400: [1001]; [2002]; [3003]",
		);
		for (const secret of [
			"token-1",
			"account-1",
			"app-1",
			"meeting-1",
			"/realtime/kit/app-1/meetings/meeting-1",
			"5005",
			"4004",
		]) {
				expect(message).not.toContain(secret);
			}
	});

	it("returns only the HTTP status when provider codes are strings", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
			errors: [
				{ code: "token-1", message: "token-1" },
				{ code: "account-1", message: "account-1" },
				{ code: "app-1", message: "app-1" },
			],
			messages: [
				{ code: "meeting-1", message: "meeting-1" },
				{
					code: "/realtime/kit/app-1/meetings/meeting-1",
					message: "/realtime/kit/app-1/meetings/meeting-1",
				},
				{ code: "5005", message: "numeric string" },
			],
			success: false,
		}), { status: 400 })));

		await expect(createRealtimeKitMeeting(await createConfig(), {
			title: "Rawkode Live production room",
		})).rejects.toThrow(/^RealtimeKit API returned 400$/);
	});
});
