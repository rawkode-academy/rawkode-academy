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
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({
			data: { id: "participant-1", token: "participant-token" },
			success: true,
		})));
		vi.stubGlobal("fetch", fetchMock);

		await expect(addRealtimeKitParticipant(await createConfig(), {
			meetingId: "meeting-1",
			name: "Rawkode",
			participantId: "rawkode",
			picture: "https://example.com/rawkode.png",
			role: "host",
		})).resolves.toEqual({
			participantId: "participant-1",
			token: "participant-token",
		});
		expect(fetchMock).toHaveBeenCalledWith(
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
