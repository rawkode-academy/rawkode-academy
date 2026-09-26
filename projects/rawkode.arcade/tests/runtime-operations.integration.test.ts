import { env, runDurableObjectAlarm, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import type { Principal } from "../src/protocol";
import { ResultProjector } from "../src/server/results";
import { RoomDirectory } from "../src/server/rooms";
import { migrateTestDatabase } from "./setup-d1";

const bindings = env as unknown as Env;
const directory = new RoomDirectory(bindings);
const host: Principal = { id: "integration-host", role: "host", displayName: "Host" };

beforeAll(async () => {
	await migrateTestDatabase();
});

function principal(value: Principal): HeadersInit {
	return {
		"content-type": "application/json",
		"x-arcade-principal": JSON.stringify(value),
	};
}

async function createRoom(gameKey = "spinlock") {
	const record = await directory.create(gameKey, `Runtime ${crypto.randomUUID()}`);
	const stub = directory.stub(record.id);
	await stub.fetch("https://game-room.internal/_internal/init", {
		method: "POST",
		body: JSON.stringify({ roomId: record.id, gameKey }),
	});
	return { record, stub };
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
		headers: principal(host),
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

async function hostState(stub: DurableObjectStub) {
	return (
		await stub.fetch("https://game-room.internal/_internal/state", {
			headers: principal(host),
		})
	).json<{
		state: {
			audience: { reactions: Record<string, number> };
			status: string;
			teams: Record<string, { score: number }>;
		};
	}>();
}

async function socketMessage(socket: WebSocket): Promise<Record<string, unknown>> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(
			() => reject(new Error("Timed out waiting for socket hello")),
			2_000,
		);
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

async function joinRoom(
	code: string,
	displayName: string,
): Promise<{ cookie?: string; roomId: string; ticket: string }> {
	const response = await SELF.fetch(`https://example.test/api/join/${encodeURIComponent(code)}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ displayName }),
	});
	expect(response.status).toBe(200);
	const body = await response.json<{ roomId: string; wsTicket: string }>();
	return {
		cookie: response.headers.get("set-cookie")?.split(";", 1)[0],
		roomId: body.roomId,
		ticket: body.wsTicket,
	};
}

async function openSocket(
	roomId: string,
	ticket: string,
): Promise<{ socket: WebSocket; hello: Record<string, unknown> }> {
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
	if (!response.webSocket) throw new Error("Socket upgrade returned no WebSocket");
	const hello = socketMessage(response.webSocket);
	response.webSocket.accept();
	return { socket: response.webSocket, hello: await hello };
}

describe("terminal room outbox and leaderboard projection", () => {
	it("projects a terminal DO result once under duplicate and concurrent delivery", async () => {
		const { record, stub } = await createRoom();
		const score = await command(stub, {
			id: "authoritative-score",
			type: "score.add",
			expectedVersion: 0,
			payload: { teamId: "team-red", points: 750 },
		});
		expect(score.status).toBe(200);
		expect(await score.json()).toMatchObject({ type: "event", version: 1 });
		const completion = await command(stub, {
			id: "terminal-completion",
			type: "room.complete",
			expectedVersion: 1,
		});
		expect(completion.status).toBe(200);
		expect(await completion.json()).toMatchObject({ type: "event", version: 2 });
		expect((await hostState(stub)).state.status).toBe("complete");
		// Completion is authoritative immediately; its D1 read model is drained
		// separately so database latency cannot delay host acknowledgement.
		await runDurableObjectAlarm(stub);

		const terminal = await bindings.DB.prepare(
			"SELECT id, payload_json, sequence, occurred_at FROM arcade_room_outbox WHERE room_id = ? AND kind = 'result.completed'",
		)
			.bind(record.id)
			.first<{
				id: string;
				payload_json: string;
				sequence: number;
				occurred_at: string;
			}>();
		expect(terminal).toBeTruthy();
		expect(JSON.parse(terminal!.payload_json)).toMatchObject({
			roomId: record.id,
			gameKey: "spinlock",
			teams: expect.arrayContaining([{ id: "team-red", score: 750 }]),
		});

		await bindings.DB.prepare(
			"INSERT INTO arcade_room_outbox (id, room_id, sequence, kind, payload_json, occurred_at) VALUES (?, ?, ?, 'result.completed', ?, ?)",
		)
			.bind(
				`${terminal!.id}:duplicate`,
				record.id,
				terminal!.sequence + 10_000,
				terminal!.payload_json,
				terminal!.occurred_at,
			)
			.run();
		const projector = new ResultProjector(bindings);
		await Promise.all([projector.consumeOutbox(), projector.consumeOutbox()]);

		const effects = await bindings.DB.prepare(
			"SELECT (SELECT COUNT(*) FROM arcade_completed_games WHERE room_id = ?) AS completions, (SELECT COUNT(*) FROM arcade_results WHERE room_id = ?) AS results, (SELECT COALESCE(SUM(score), 0) FROM arcade_results WHERE room_id = ?) AS total_score, (SELECT score FROM arcade_results WHERE room_id = ? AND team_id = 'team-red') AS red_score",
		)
			.bind(record.id, record.id, record.id, record.id)
			.first<{
				completions: number;
				results: number;
				total_score: number;
				red_score: number;
			}>();
		expect(effects).toEqual({
			completions: 1,
			results: 2,
			total_score: 750,
			red_score: 750,
		});
		const checkpoints = await bindings.DB.prepare(
			"SELECT COUNT(*) AS count FROM arcade_room_outbox_projections WHERE outbox_id IN (?, ?)",
		)
			.bind(terminal!.id, `${terminal!.id}:duplicate`)
			.first<{ count: number }>();
		expect(checkpoints?.count).toBe(2);

		const leaderboard = await SELF.fetch(
			`https://example.test/api/rooms/${encodeURIComponent(record.id)}/leaderboard`,
		);
		expect(leaderboard.status).toBe(200);
		expect(await leaderboard.json()).toMatchObject({
			roomId: record.id,
			entries: expect.arrayContaining([
				expect.objectContaining({ teamId: "team-red", score: 750 }),
			]),
		});
	});
});

describe("audience shard retry and cross-shard aggregation", () => {
	it("retains a failed flush and sums reaction totals from independent shards", async () => {
		const { record, stub } = await createRoom("null-pointer");
		const first = bindings.AUDIENCE_SHARD.get(
			bindings.AUDIENCE_SHARD.idFromName(`${record.id}:audience:0`),
		);
		const second = bindings.AUDIENCE_SHARD.get(
			bindings.AUDIENCE_SHARD.idFromName(`${record.id}:audience:1`),
		);
		const submit = (shard: DurableObjectStub, shardId: string, viewer: string, commandId: string) =>
			shard.fetch("https://audience-shard.internal/_internal/submit-reaction", {
				method: "POST",
				headers: principal({ id: viewer, role: "audience" }),
				body: JSON.stringify({
					roomId: record.id,
					promptId: "reaction-window",
					shardId,
					reaction: "ship-it",
					commandId,
				}),
			});

		expect((await submit(first, "0", "viewer-0", "reaction-0")).status).toBe(202);
		const unguarded = await first.fetch(
			"https://audience-shard.internal/_internal/testing/fail-next-flush",
			{ method: "POST" },
		);
		expect(unguarded.status).toBe(404);
		const failure = await first.fetch(
			"https://audience-shard.internal/_internal/testing/fail-next-flush",
			{
				method: "POST",
				headers: { "x-arcade-test-secret": bindings.E2E_SEED_SECRET! },
			},
		);
		expect(failure.status).toBe(200);

		await runDurableObjectAlarm(first);
		expect((await hostState(stub)).state.audience.reactions).toEqual({});
		await runDurableObjectAlarm(first);
		expect((await hostState(stub)).state.audience.reactions).toEqual({
			"ship-it": 1,
		});

		expect((await submit(second, "1", "viewer-1", "reaction-1")).status).toBe(202);
		expect((await submit(second, "1", "viewer-2", "reaction-2")).status).toBe(202);
		await runDurableObjectAlarm(second);
		expect((await hostState(stub)).state.audience.reactions).toEqual({
			"ship-it": 3,
		});
	});

	it("reports audience connections on their server-selected shards and removes them on close", async () => {
		const { record, stub } = await createRoom("merge-conflict");
		const prompt = await command(stub, {
			id: "presence-round",
			type: "prompt.open",
			expectedVersion: 0,
			payload: {
				id: "presence-round-one",
				prompt: "How many audience members are connected?",
				answer: "The authoritative count",
			},
		});
		expect(prompt.status).toBe(200);
		const expiresAt = new Date(Date.now() + 60_000).toISOString();
		const hostCode = await directory.createInvite(record.id, "host", expiresAt);
		const audienceCode = await directory.createInvite(record.id, "audience", expiresAt);
		const hostJoin = await joinRoom(hostCode, "Presence Host");
		expect(hostJoin.cookie).toBeTruthy();

		const sockets: WebSocket[] = [];
		const displayNames = new Set<string>();
		const observedShards = new Set<string>();
		for (let index = 0; index < 12 && observedShards.size < 2; index += 1) {
			const displayName = `Audience ${index}`;
			const admitted = await joinRoom(audienceCode, displayName);
			const { socket, hello } = await openSocket(record.id, admitted.ticket);
			expect(hello).toMatchObject({
				event: "audience.connected",
				payload: { roomId: record.id },
			});
			const shardId = (hello.payload as { shardId?: string }).shardId;
			expect(shardId).toBeTruthy();
			observedShards.add(shardId!);
			displayNames.add(displayName);
			sockets.push(socket);
		}
		expect(observedShards.size).toBe(2);
		for (const shardId of observedShards) await runDurableObjectAlarm(bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${record.id}:audience:${shardId}`)));

		const presenceResponse = await SELF.fetch(
			`https://example.test/api/rooms/${encodeURIComponent(record.id)}/presence`,
			{ headers: { cookie: hostJoin.cookie! } },
		);
		expect(presenceResponse.status).toBe(200);
		const presence = await presenceResponse.json<{
			presence: Array<{
				displayName?: string;
				role: string;
				shardId?: string;
				connections: number;
			}>;
		}>();
		const connected = presence.presence.filter(
			(entry) => entry.role === "audience" && displayNames.has(entry.displayName ?? ""),
		);
		// Audience presence is a shard aggregate, not one D1 identity write per
		// socket. Operator/contestant presence remains in this private read model.
		expect(connected).toHaveLength(0);
		await expect.poll(async () => {
			const response = await SELF.fetch(`https://example.test/api/rooms/${encodeURIComponent(record.id)}/state`);
			return (await response.json<{ state: { audienceCount: number } }>()).state.audienceCount;
		}, { interval: 25, timeout: 2_000 }).toBe(sockets.length);

		const publicState = await SELF.fetch(
			`https://example.test/api/rooms/${encodeURIComponent(record.id)}/state`,
		);
		expect(publicState.status).toBe(200);
		expect(await publicState.json()).toMatchObject({
			state: {
				audienceCount: sockets.length,
				round: {
					index: 1,
					id: "presence-round-one",
					phase: "question",
				},
			},
		});

		for (const socket of sockets) socket.close(1000, "presence acceptance complete");
		let disconnected = false;
		for (let attempt = 0; attempt < 20 && !disconnected; attempt += 1) {
			await new Promise((resolve) => setTimeout(resolve, 25));
			const response = await SELF.fetch(`https://example.test/api/rooms/${encodeURIComponent(record.id)}/state`);
			const body = await response.json<{ state: { audienceCount: number } }>();
			disconnected = body.state.audienceCount === 0;
		}
		expect(disconnected).toBe(true);
	});
});
