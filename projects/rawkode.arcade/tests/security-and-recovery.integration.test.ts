import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { createAnonymousSession } from "../src/server/auth";
import { RoomDirectory } from "../src/server/rooms";
import { migrateTestDatabase } from "./setup-d1";

const bindings = env as unknown as Env;

beforeAll(async () => {
	await migrateTestDatabase();
});

function principal(id: string, role: string): HeadersInit {
	return {
		"x-arcade-principal": JSON.stringify({ id, role, displayName: id }),
	};
}

async function room(name: string, gameKey = "spinlock") {
	const now = new Date().toISOString();
	await bindings.DB.prepare(
		"INSERT OR IGNORE INTO arcade_room_directory (id, game_key, title, status, created_at, updated_at) VALUES (?, ?, ?, 'lobby', ?, ?)",
	)
		.bind(name, gameKey, `Integration ${name}`, now, now)
		.run();
	const stub = bindings.GAME_ROOM.get(bindings.GAME_ROOM.idFromName(name));
	await stub.fetch("https://game-room.internal/_internal/init", {
		method: "POST",
		body: JSON.stringify({ roomId: name, gameKey }),
	});
	return stub;
}

async function command(
	stub: DurableObjectStub,
	input: {
		id: string;
		type: string;
		expectedVersion: number;
		payload?: Record<string, unknown>;
	},
) {
	return stub.fetch("https://game-room.internal/_internal/command", {
		method: "POST",
		headers: {
			...principal("integration-host", "host"),
			"content-type": "application/json",
		},
		body: JSON.stringify({
			v: 1,
			id: input.id,
			type: input.type,
			expectedVersion: input.expectedVersion,
			payload: input.payload ?? {},
			sentAt: new Date().toISOString(),
		}),
	});
}

describe("role-safe recovery through the production GameRoom", () => {
	it("keeps private answers out of player, audience, and display snapshots", async () => {
		const marker = `private-${crypto.randomUUID()}`;
		const stub = await room(`redaction-${crypto.randomUUID()}`);
		const opened = await command(stub, {
			id: "open-private-prompt",
			type: "prompt.open",
			expectedVersion: 0,
			payload: {
				id: "private-prompt",
				prompt: "A public prompt",
				answer: marker,
				e2ePrivateMarker: marker,
			},
		});
		expect(opened.ok).toBe(true);

		const host = await (
			await stub.fetch("https://game-room.internal/_internal/state", {
				headers: principal("host", "host"),
			})
		).text();
		expect(host).toContain(marker);

		for (const role of ["player", "audience", "display"] as const) {
			const snapshot = await (
				await stub.fetch("https://game-room.internal/_internal/state", {
					headers: principal(`viewer-${role}`, role),
				})
			).text();
			expect(snapshot).not.toContain(marker);
			expect(snapshot).not.toContain("e2ePrivateMarker");
		}
	});

	it("returns a contiguous suffix or a redacted snapshot across a replay gap", async () => {
		const stub = await room(`replay-${crypto.randomUUID()}`);
		await command(stub, {
			id: "start",
			type: "room.start",
			expectedVersion: 0,
		});
		await command(stub, {
			id: "open",
			type: "prompt.open",
			expectedVersion: 1,
			payload: { id: "prompt", prompt: "Public", answer: "private" },
		});

		const suffix = await (
			await stub.fetch("https://game-room.internal/_internal/replay?after=1", {
				headers: principal("display", "display"),
			})
		).json<{
			kind: string;
			events: Array<{ version: number }>;
		}>();
		expect(suffix.kind).toBe("events");
		expect(suffix.events.map((event) => event.version)).toEqual([2]);
		expect(JSON.stringify(suffix.events)).not.toContain("private");

		const gap = await (
			await stub.fetch("https://game-room.internal/_internal/replay?after=-1", {
				headers: principal("display", "display"),
			})
		).json<{ kind: string; state: unknown }>();
		expect(gap.kind).toBe("snapshot");
		expect(JSON.stringify(gap.state)).not.toContain("private");
	});
});

describe("single-use WebSocket admission", () => {
	it("rejects reuse of the same ticket nonce at the Durable Object boundary", async () => {
		const stub = await room(`ticket-${crypto.randomUUID()}`);
		const headers = {
			...principal("audience-one", "audience"),
			upgrade: "websocket",
			"x-arcade-ticket-nonce": `nonce-${crypto.randomUUID()}`,
		};

		const first = await stub.fetch("https://game-room.internal/_internal/connect", {
			headers,
		});
		expect(first.status).toBe(101);
		first.webSocket?.accept();

		const replay = await stub.fetch("https://game-room.internal/_internal/connect", {
			headers,
		});
		expect(replay.status).toBe(401);
		expect(await replay.text()).toContain("already been used");
	});
});

describe("audience participation through production storage and HTTP", () => {
	it("rejects a public audience command without an id before shard admission", async () => {
		const roomId = `missing-command-id-${crypto.randomUUID()}`;
		await room(roomId, "null-pointer");
		const session = await createAnonymousSession(bindings, "Untracked viewer");
		await new RoomDirectory(bindings).admit(roomId, session.principal);
		const response = await SELF.fetch(
			`https://example.test/api/rooms/${encodeURIComponent(roomId)}/commands`,
			{
				method: "POST",
				headers: { "content-type": "application/json", cookie: session.cookie.split(";", 1)[0]! },
				body: JSON.stringify({ v: 1, type: "audience.vote", expectedVersion: 0, sentAt: new Date().toISOString(), payload: { promptId: "null-0", choice: "Rust" } }),
			},
		);
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: { code: "BAD_REQUEST" } });
	});

	it("accepts one ballot per audience identity in a round", async () => {
		const roomId = `dedupe-${crypto.randomUUID()}`;
		const game = await room(roomId, "null-pointer");
		await command(game, {
			id: "open-audience-round",
			type: "prompt.open",
			expectedVersion: 0,
			payload: { id: "round-one", prompt: "Pick one" },
		});
		const shard = bindings.AUDIENCE_SHARD.get(
			bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:0`),
		);
		const submit = (commandId: string, choice: string) =>
			shard.fetch("https://audience-shard.internal/_internal/submit", {
				method: "POST",
				headers: {
					...principal("same-viewer", "audience"),
					"content-type": "application/json",
				},
				body: JSON.stringify({
					roomId,
					shardId: "0",
					promptId: "round-one",
					choice,
					commandId,
				}),
			});

		const first = await submit("vote-one", "Rust");
		const duplicate = await submit("vote-two", "Zig");
		expect(first.status).toBe(202);
		expect(await first.json()).toMatchObject({ accepted: true });
		expect(await duplicate.json()).toMatchObject({ accepted: true, duplicate: true, shardId: "0" });
	});

	it("returns HTTP 409 for an audience vote after the host freezes the round", async () => {
		const roomId = `http-frozen-${crypto.randomUUID()}`;
		const game = await room(roomId, "null-pointer");
		await command(game, {
			id: "open-before-freeze",
			type: "prompt.open",
			expectedVersion: 0,
			payload: { id: "round-frozen", prompt: "Pick one" },
		});
		await command(game, {
			id: "freeze-round",
			type: "audience.freeze",
			expectedVersion: 1,
		});
		const session = await createAnonymousSession(bindings, "Late viewer");
		await new RoomDirectory(bindings).admit(roomId, session.principal);
		const response = await SELF.fetch(
			`https://example.test/api/rooms/${encodeURIComponent(roomId)}/commands`,
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					cookie: session.cookie.split(";", 1)[0]!,
				},
				body: JSON.stringify({
					v: 1,
					id: "late-http-vote",
					type: "audience.vote",
					expectedVersion: 2,
					sentAt: new Date().toISOString(),
					payload: { promptId: "round-frozen", choice: "Rust" },
				}),
			},
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({
			error: { code: "DISTRIBUTION_FROZEN" },
		});
	});
});
