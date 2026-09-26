import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import type { Principal } from "../src/protocol";
import { signJson } from "../src/server/crypto";
import { RoomDirectory } from "../src/server/rooms";
import { verifyRoomTicket } from "../src/server/tickets";
import { migrateTestDatabase } from "./setup-d1";

const bindings = env as unknown as Env;
const directory = new RoomDirectory(bindings);

beforeAll(async () => {
	await migrateTestDatabase();
});

function internalPrincipal(principal: Principal): HeadersInit {
	return {
		"content-type": "application/json",
		"x-arcade-principal": JSON.stringify(principal),
	};
}

async function createRoom(gameKey = "spinlock") {
	const record = await directory.create(gameKey, `Acceptance ${crypto.randomUUID()}`);
	const stub = directory.stub(record.id);
	await stub.fetch("https://game-room.internal/_internal/init", {
		method: "POST",
		body: JSON.stringify({ roomId: record.id, gameKey }),
	});
	return { record, stub };
}

async function invite(roomId: string, role: "host" | "player" | "audience" | "display") {
	return directory.createInvite(
		roomId,
		role,
		new Date(Date.now() + 60_000).toISOString(),
	);
}

async function join(
	code: string,
	body: { displayName: string; teamId?: string; desiredRole?: "player" | "audience" },
	cookie?: string,
) {
	const response = await SELF.fetch(
		`https://example.test/api/join/${encodeURIComponent(code)}`,
		{
			method: "POST",
			headers: {
				"content-type": "application/json",
				...(cookie ? { cookie } : {}),
			},
			body: JSON.stringify(body),
		},
	);
	const payload = await response.json<{
		roomId: string;
		role: string;
		wsTicket: string;
		socketUrl: string;
	}>();
	return {
		response,
		payload,
		cookie: response.headers.get("set-cookie")?.split(";", 1)[0],
	};
}

async function nextMessage(socket: WebSocket): Promise<Record<string, unknown>> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error("Timed out waiting for WebSocket message")), 2_000);
		socket.addEventListener(
			"message",
			(event) => {
				clearTimeout(timeout);
				try {
					resolve(JSON.parse(String(event.data)) as Record<string, unknown>);
				} catch (error) {
					reject(error);
				}
			},
			{ once: true },
		);
	});
}

async function connect(roomId: string, ticket: string) {
	const protocol = `arcade-ticket.${ticket}`;
	const response = await SELF.fetch(
		`https://example.test/api/rooms/${encodeURIComponent(roomId)}/socket`,
		{
			headers: {
				upgrade: "websocket",
				"sec-websocket-protocol": protocol,
			},
		},
	);
	expect(response.status).toBe(101);
	expect(response.headers.get("sec-websocket-protocol")).toBe(protocol);
	const socket = response.webSocket;
	if (!socket) throw new Error("Upgrade did not return a WebSocket");
	const firstMessage = nextMessage(socket);
	socket.accept();
	return { socket, firstMessage };
}

describe("production authentication and room membership", () => {
	it("serves the room-owned roster and admits a contestant to its selected live team", async () => {
		const host: Principal = { id: `roster-host-${crypto.randomUUID()}`, role: "host" };
		const { record, stub } = await createRoom();
		await directory.admit(record.id, host);
		await stub.fetch("https://game-room.internal/_internal/command", {
			method: "POST", headers: internalPrincipal(host),
			body: JSON.stringify({ v: 1, id: "add-team", type: "team.upsert", expectedVersion: 0, payload: { teamId: "team-green", name: "Green Threads" }, sentAt: new Date().toISOString() }),
		});
		const code = await invite(record.id, "player");
		const roster = await SELF.fetch(`https://example.test/api/join/${encodeURIComponent(code)}/teams`);
		expect(roster.status).toBe(200);
		expect(await roster.json()).toMatchObject({ roomId: record.id, teams: expect.arrayContaining([{ id: "team-green", name: "Green Threads" }]) });
		const canonical = await join(record.id, { displayName: "Green player", teamId: "team-green" });
		expect(canonical.payload).toMatchObject({ role: "audience" });
		const joined = await join(code, { displayName: "Green player", teamId: "team-green" }, canonical.cookie);
		expect(joined.response.status).toBe(200);
		const ticket = await verifyRoomTicket(bindings, joined.payload.wsTicket, record.id);
		expect(ticket?.principal).toMatchObject({ role: "player", teamId: "team-green" });
	});

	it("caps the on-camera roster at 24 contestants while retaining existing players", async () => {
		const record = await directory.create("spinlock", `Capacity ${crypto.randomUUID()}`);
		const admitted = await Promise.all(Array.from({ length: 25 }, (_value, index) => directory.admitContestant(record.id, { id: `contestant-${index}`, teamId: "team-red" })));
		expect(admitted.filter(Boolean)).toHaveLength(24);
		expect(await directory.admitContestant(record.id, { id: "contestant-0", teamId: "team-blue" })).toBe(true);
	});

	it("rejects the 25th concurrent player invitation at the admission boundary", async () => {
		const { record } = await createRoom();
		const codes = await Promise.all(Array.from({ length: 25 }, () => invite(record.id, "player")));
		const joins = await Promise.all(codes.map((code, index) =>
			SELF.fetch(`https://example.test/api/join/${encodeURIComponent(code)}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ displayName: `Contestant ${index}`, teamId: "team-red" }),
			}),
		));
		expect(joins.filter((response) => response.status === 200)).toHaveLength(24);
		const rejected = joins.filter((response) => response.status === 409);
		expect(rejected).toHaveLength(1);
		expect(await rejected[0]!.json()).toMatchObject({ error: { code: "CONTESTANT_CAPACITY" } });
	});

	it("denies host and content administration to an anonymous request", async () => {
		const room = await SELF.fetch("https://example.test/api/rooms", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ gameKey: "spinlock", title: "Unauthorized" }),
		});
		expect(room.status).toBe(403);

		const content = await SELF.fetch("https://example.test/api/content/packs", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ gameKey: "spinlock", slug: "unauthorized", title: "Unauthorized" }),
		});
		expect(content.status).toBe(403);
	});

	it("preserves producer membership through create, host navigation, and reload", async () => {
		const producer: Principal = { id: `producer-${crypto.randomUUID()}`, role: "producer", displayName: "Arcade Producer" };
		const token = await signJson({ ...producer, exp: Date.now() + 60_000 }, bindings.SESSION_SECRET);
		const cookie = `arcade_session=${token}`;
		const created = await SELF.fetch("https://example.test/api/rooms", {
			method: "POST",
			headers: { "content-type": "application/json", cookie },
			body: JSON.stringify({ gameKey: "spinlock", title: "Producer recovery" }),
		});
		expect(created.status).toBe(201);
		const roomId = (await created.json<{ room: { id: string } }>()).room.id;

		const canonicalJoin = await join(roomId, { displayName: "Arcade Producer" }, cookie);
		expect(canonicalJoin.response.status).toBe(200);
		expect(canonicalJoin.payload.role).toBe("producer");
		const membership = await SELF.fetch(`https://example.test/api/rooms/${encodeURIComponent(roomId)}/membership`, { headers: { cookie } });
		expect(membership.status).toBe(200);
		expect(await membership.json()).toMatchObject({ role: "producer", displayName: "Arcade Producer" });

		const renewal = await SELF.fetch(`https://example.test/api/rooms/${encodeURIComponent(roomId)}/ws-ticket`, { method: "POST", headers: { cookie } });
		expect(renewal.status).toBe(200);
		const ticket = await verifyRoomTicket(bindings, (await renewal.json<{ ticket: string }>()).ticket, roomId);
		expect(ticket?.principal).toMatchObject({ id: producer.id, role: "producer" });
	});

	it("issues a lower-scoped invite ticket without demoting the host membership", async () => {
		const host: Principal = { id: `host-${crypto.randomUUID()}`, role: "host", displayName: "Recovery Host" };
		const { record, stub } = await createRoom();
		await directory.admit(record.id, host);
		const token = await signJson({ ...host, exp: Date.now() + 60_000 }, bindings.SESSION_SECRET);
		const cookie = `arcade_session=${token}`;
		const privateAnswer = `operator-secret-${crypto.randomUUID()}`;
		await stub.fetch("https://game-room.internal/_internal/command", {
			method: "POST",
			headers: internalPrincipal(host),
			body: JSON.stringify({ v: 1, id: "private-prompt", type: "prompt.open", expectedVersion: 0, payload: { id: "private", prompt: "Public prompt", answer: privateAnswer }, sentAt: new Date().toISOString() }),
		});
		const audienceCode = await invite(record.id, "audience");

		const audienceJoin = await join(audienceCode, { displayName: "Recovery Host" }, cookie);
		expect(audienceJoin.response.status).toBe(200);
		expect(audienceJoin.payload.role).toBe("audience");
		const audienceTicket = await verifyRoomTicket(bindings, audienceJoin.payload.wsTicket, record.id);
		expect(audienceTicket?.principal).toMatchObject({ id: host.id, role: "audience" });
		const viewCookie = audienceJoin.response.headers.get("set-cookie")?.split(";", 1)[0];
		expect(viewCookie).toContain("arcade_view_scope=");
		const scopedCookie = `${cookie}; ${viewCookie}`;
		const audienceState = await SELF.fetch(
			`https://example.test/api/rooms/${encodeURIComponent(record.id)}/state`,
			{ headers: { cookie: scopedCookie, "x-arcade-view-role": "audience" } },
		);
		expect(audienceState.status).toBe(200);
		expect(await audienceState.text()).not.toContain(privateAnswer);
		const audienceRenewal = await SELF.fetch(
			`https://example.test/api/rooms/${encodeURIComponent(record.id)}/ws-ticket`,
			{ method: "POST", headers: { cookie: scopedCookie, "x-arcade-view-role": "audience" } },
		);
		expect(audienceRenewal.status).toBe(200);
		const renewedAudienceTicket = await verifyRoomTicket(bindings, (await audienceRenewal.json<{ ticket: string }>()).ticket, record.id);
		expect(renewedAudienceTicket?.principal).toMatchObject({ id: host.id, role: "audience" });

		const membership = await SELF.fetch(
			`https://example.test/api/rooms/${encodeURIComponent(record.id)}/membership`,
			{ headers: { cookie } },
		);
		expect(membership.status).toBe(200);
		expect(await membership.json()).toMatchObject({ role: "host", displayName: "Recovery Host" });

		const renewal = await SELF.fetch(
			`https://example.test/api/rooms/${encodeURIComponent(record.id)}/ws-ticket`,
			{ method: "POST", headers: { cookie } },
		);
		expect(renewal.status).toBe(200);
		const renewedTicket = await verifyRoomTicket(
			bindings,
			(await renewal.json<{ ticket: string }>()).ticket,
			record.id,
		);
		expect(renewedTicket?.principal).toMatchObject({ id: host.id, role: "host" });
	});

	it("persists the server-scoped contestant name and team and forbids cross-room tickets", async () => {
		const first = await createRoom();
		const second = await createRoom();
		const code = await invite(first.record.id, "player");
		const admitted = await join(code, {
			displayName: "Ada Lovelace",
			teamId: "team-red",
		});
		expect(admitted.response.status).toBe(200);
		expect(admitted.cookie).toBeTruthy();
		expect(admitted.payload).toMatchObject({ roomId: first.record.id, role: "player" });

		const ticket = await verifyRoomTicket(bindings, admitted.payload.wsTicket, first.record.id);
		expect(ticket?.principal).toMatchObject({
			role: "player",
			teamId: "team-red",
			displayName: "Ada Lovelace",
		});
		const membership = await bindings.DB.prepare(
			"SELECT role, team_id, display_name FROM arcade_room_memberships WHERE room_id = ? AND principal_id = ?",
		)
			.bind(first.record.id, ticket?.principal.id)
			.first<{ role: string; team_id: string | null; display_name: string | null }>();
		expect(membership).toEqual({
			role: "player",
			team_id: "team-red",
			display_name: "Ada Lovelace",
		});

		const crossRoom = await SELF.fetch(
			`https://example.test/api/rooms/${encodeURIComponent(second.record.id)}/ws-ticket`,
			{
				method: "POST",
				headers: { cookie: admitted.cookie! },
			},
		);
		expect(crossRoom.status).toBe(403);
		expect(await crossRoom.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
	});
});

describe("public reconnect and replay recovery", () => {
	it("renews a member ticket and restores the latest redacted room version", async () => {
		const { record, stub } = await createRoom();
		const secret = `answer-${crypto.randomUUID()}`;
		const host: Principal = { id: "host", role: "host", displayName: "Host" };
		await stub.fetch("https://game-room.internal/_internal/command", {
			method: "POST",
			headers: internalPrincipal(host),
			body: JSON.stringify({
				v: 1,
				id: "open-before-connect",
				type: "prompt.open",
				expectedVersion: 0,
				payload: { id: "prompt-one", prompt: "Public prompt", answer: secret },
				sentAt: new Date().toISOString(),
			}),
		});

		const code = await invite(record.id, "player");
		const admitted = await join(code, { displayName: "Reconnect Player", teamId: "team-blue" });
		const firstConnection = await connect(record.id, admitted.payload.wsTicket);
		const firstSnapshot = await firstConnection.firstMessage;
		expect(firstSnapshot).toMatchObject({ type: "snapshot", version: 1 });
		expect(JSON.stringify(firstSnapshot)).not.toContain(secret);
		firstConnection.socket.close(1000, "reconnect test");

		await stub.fetch("https://game-room.internal/_internal/command", {
			method: "POST",
			headers: internalPrincipal(host),
			body: JSON.stringify({
				v: 1,
				id: "pause-while-offline",
				type: "room.pause",
				expectedVersion: 1,
				payload: {},
				sentAt: new Date().toISOString(),
			}),
		});

		const renewal = await SELF.fetch(
			`https://example.test/api/rooms/${encodeURIComponent(record.id)}/ws-ticket`,
			{
				method: "POST",
				headers: { cookie: admitted.cookie! },
			},
		);
		expect(renewal.status).toBe(200);
		const renewed = await renewal.json<{ ticket: string }>();
		const secondConnection = await connect(record.id, renewed.ticket);
		const recovered = await secondConnection.firstMessage;
		expect(recovered).toMatchObject({ type: "snapshot", version: 2 });
		expect(JSON.stringify(recovered)).not.toContain(secret);
		secondConnection.socket.close(1000, "done");
	});
});
