import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { migrateTestDatabase } from "./setup-d1";

const bindings = env as unknown as Env;
const principal = (id: string, role: string, teamId?: string) => ({ "x-arcade-principal": JSON.stringify({ id, role, teamId }) });

beforeAll(async () => {
	await migrateTestDatabase();
});

async function room(name: string, gameKey = "race-condition") {
	const stub = bindings.GAME_ROOM.get(bindings.GAME_ROOM.idFromName(name));
	await stub.fetch("https://game-room.internal/_internal/init", { method: "POST", body: JSON.stringify({ roomId: name, gameKey }) });
	return stub;
}

async function waitForSocketMessage(
	socket: WebSocket,
	predicate: (message: Record<string, unknown>) => boolean,
	timeoutMs = 4_000,
): Promise<Record<string, unknown>> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error("Timed out waiting for matching WebSocket message")), timeoutMs);
		const onMessage = (event: MessageEvent) => {
			const message = JSON.parse(String(event.data)) as Record<string, unknown>;
			if (!predicate(message)) return;
			clearTimeout(timeout);
			socket.removeEventListener("message", onMessage);
			resolve(message);
		};
		socket.addEventListener("message", onMessage);
	});
}

describe("GameRoom Durable Object storage", () => {
	it("stores duplicate commands once, atomically awards a buzzer, and replays committed events", async () => {
		const stub = await room(`room-${crypto.randomUUID()}`);
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		const start = { v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() };
		const first = await (await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify(start) })).json<{ version: number }>();
		const duplicate = await (await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify(start) })).json<{ version: number }>();
		expect(duplicate.version).toBe(first.version);
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "prompt", type: "prompt.open", expectedVersion: 1, payload: { id: "prompt-1", prompt: "Race?" }, sentAt: new Date().toISOString() }) });
		const buzz = (id: string, player: string, teamId: string) => stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: { ...principal(player, "player", teamId), "content-type": "application/json" }, body: JSON.stringify({ v: 1, id, type: "buzzer.press", expectedVersion: 2, payload: {}, sentAt: new Date().toISOString() }) });
		const responses = await Promise.all([buzz("buzz-a", "a", "team-red"), buzz("buzz-b", "b", "team-blue")]);
		expect(responses.filter((response) => response.status === 200)).toHaveLength(2);
		const bodies = await Promise.all(responses.map((response) => response.json<{ type: string; code?: string }>()));
		expect(bodies.filter((body) => body.type === "event")).toHaveLength(1);
		expect(bodies.filter((body) => body.code === "CONFLICT")).toHaveLength(1);
		const replay = await (await stub.fetch("https://game-room.internal/_internal/replay?after=0", { headers: principal("display", "display") })).json<{ kind: string; events: unknown[] }>();
		expect(replay.kind).toBe("events");
		expect(replay.events.length).toBeGreaterThanOrEqual(3);
	});

	it("routes Race Condition buzz and answer through the authoritative reducer", async () => {
		const stub = await room(`race-live-${crypto.randomUUID()}`, "race-condition");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		const playerHeaders = { ...principal("racer", "player", "team-red"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		const buzz = await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: playerHeaders, body: JSON.stringify({ v: 1, id: "buzz", type: "buzzer.press", expectedVersion: 1, payload: {}, sentAt: new Date().toISOString() }) });
		expect((await buzz.json<{ type: string }>()).type).toBe("event");
		const answer = await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: playerHeaders, body: JSON.stringify({ v: 1, id: "answer", type: "answer.submit", expectedVersion: 2, payload: { answer: "queue" }, sentAt: new Date().toISOString() }) });
		expect((await answer.json<{ type: string }>()).type).toBe("event");
		const snapshot = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { teams: Record<string, { score: number }>; private: { runtime: { state: { settled?: boolean; buzzed?: unknown } } } } }>();
		expect(snapshot.state.teams["team-red"].score).toBe(200);
		expect(snapshot.state.private.runtime.state).toMatchObject({ settled: true });
		expect(snapshot.state.private.runtime.state.buzzed).toBeUndefined();
	});

	it("rejects fresh gameplay commands after pause or completion without mutating the room", async () => {
		const send = async (stub: DurableObjectStub, id: string, type: string, expectedVersion: number, role = "host") => stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: { ...principal(role, role), "content-type": "application/json" }, body: JSON.stringify({ v: 1, id, type, expectedVersion, payload: type === "prompt.open" ? { id: "round", prompt: "Question" } : {}, sentAt: new Date().toISOString() }) });
		const paused = await room(`paused-${crypto.randomUUID()}`);
		await send(paused, "open", "prompt.open", 0);
		await send(paused, "pause", "room.pause", 1);
		const blockedPause = await send(paused, "paused-buzz", "buzzer.press", 2, "player");
		expect((await blockedPause.json<{ code: string }>()).code).toBe("FORBIDDEN");
		const pausedState = await (await paused.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { status: string; buzzer?: unknown } }>();
		expect(pausedState.state.status).toBe("paused");
		expect(pausedState.state.buzzer).toBeUndefined();

		const completedId = `complete-${crypto.randomUUID()}`;
		const now = new Date().toISOString();
		await bindings.DB.prepare("INSERT INTO arcade_room_directory (id, game_key, content_revision_id, title, status, created_by, created_at, updated_at) VALUES (?, ?, NULL, ?, 'lobby', NULL, ?, ?)").bind(completedId, "race-condition", "terminal test", now, now).run();
		const completed = await room(completedId);
		await send(completed, "open", "prompt.open", 0);
		await send(completed, "complete", "room.complete", 1);
		const blockedComplete = await send(completed, "complete-buzz", "buzzer.press", 2, "player");
		expect((await blockedComplete.json<{ code: string }>()).code).toBe("FORBIDDEN");
		const completeState = await (await completed.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { status: string; buzzer?: unknown } }>();
		expect(completeState.state.status).toBe("complete");
		expect(completeState.state.buzzer).toBeUndefined();
	});

	it("redacts private prompt material from display replay events", async () => {
		const stub = await room(`replay-secret-${crypto.randomUUID()}`);
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "private-prompt", type: "prompt.open", expectedVersion: 0, payload: { id: "private", prompt: "Public", answer: "never-display", e2ePrivateMarker: "never-display-marker" }, sentAt: new Date().toISOString() }) });
		const replay = await (await stub.fetch("https://game-room.internal/_internal/replay?after=0", { headers: principal("display", "display") })).text();
		expect(replay).not.toContain("never-display");
		expect(replay).not.toContain("never-display-marker");
	});

	it("rejects an answer after its authoritative prompt deadline", async () => {
		const stub = await room(`deadline-${crypto.randomUUID()}`, "ten-nines");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "prompt", type: "prompt.open", expectedVersion: 0, payload: { id: "expired", prompt: "Late", closesAt: new Date(Date.now() - 1).toISOString() }, sentAt: new Date().toISOString() }) });
		const response = await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: { ...principal("player", "player", "red"), "content-type": "application/json" }, body: JSON.stringify({ v: 1, id: "late", type: "answer.submit", expectedVersion: 1, payload: { teamId: "red" }, sentAt: new Date().toISOString() }) });
		expect((await response.json<{ code: string }>()).code).toBe("DEADLINE_EXPIRED");
	});

	it("commits a score once when an answer command is retried", async () => {
		const stub = await room(`score-${crypto.randomUUID()}`, "spinlock");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		const answer = { v: 1, id: "answer-once", type: "answer.submit", expectedVersion: 1, payload: { answer: "eventual consistency", points: 100_000 }, sentAt: new Date().toISOString() };
		const playerHeaders = { ...principal("player", "player", "team-red"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: playerHeaders, body: JSON.stringify(answer) });
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: playerHeaders, body: JSON.stringify(answer) });
		const state = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { teams: Record<string, { score: number }> } }>();
		expect(state.state.teams["team-red"].score).toBe(500);
	});

	it("automatically retries result projection after outbox delivery succeeds", async () => {
		const roomId = `projection-retry-${crypto.randomUUID()}`;
		const now = new Date().toISOString();
		await bindings.DB.prepare("INSERT INTO arcade_room_directory (id, game_key, content_revision_id, title, status, created_by, created_at, updated_at) VALUES (?, ?, NULL, ?, 'lobby', NULL, ?, ?)").bind(roomId, "spinlock", "projection retry", now, now).run();
		const stub = await room(roomId, "spinlock");
		await stub.fetch("https://game-room.internal/_internal/testing/fail-next-projection", { method: "POST", headers: { "x-arcade-test-secret": "test-only-local-secret" } });
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: { ...principal("host", "host"), "content-type": "application/json" }, body: JSON.stringify({ v: 1, id: "complete", type: "room.complete", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		for (let attempt = 0; attempt < 30; attempt += 1) {
			const projected = await bindings.DB.prepare("SELECT COUNT(*) AS count FROM arcade_results WHERE room_id = ?").bind(roomId).first<{ count: number }>();
			if ((projected?.count ?? 0) > 0) return;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		const projected = await bindings.DB.prepare("SELECT COUNT(*) AS count FROM arcade_results WHERE room_id = ?").bind(roomId).first<{ count: number }>();
		expect(projected?.count).toBeGreaterThan(0);
	});

	it("rejects a vote after the host freezes the audience distribution", async () => {
		const roomId = `frozen-${crypto.randomUUID()}`;
		const stub = await room(roomId, "null-pointer");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "freeze", type: "audience.freeze", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:0`));
		const response = await shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal("viewer", "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "0", promptId: "round", choice: "Rust", commandId: "late" }) });
		expect(response.status).toBe(409);
		expect((await response.json<{ error: { code: string } }>()).error.code).toBe("DISTRIBUTION_FROZEN");
	});

	it("lets a host freeze and reveal a Null Pointer round with zero audience responses", async () => {
		const stub = await room(`zero-audience-${crypto.randomUUID()}`, "null-pointer");
		const headers = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		const freeze = await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers, body: JSON.stringify({ v: 1, id: "freeze-empty", type: "audience.freeze", expectedVersion: 1, payload: {}, sentAt: new Date().toISOString() }) });
		expect((await freeze.json<{ type: string }>()).type).toBe("event");
		const reveal = await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers, body: JSON.stringify({ v: 1, id: "reveal-empty", type: "prompt.reveal", expectedVersion: 2, payload: {}, sentAt: new Date().toISOString() }) });
		expect((await reveal.json<{ type: string }>()).type).toBe("event");
		const state = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("display", "display") })).json<{ state: { audience: { frozen?: boolean }; audienceDistribution: Record<string, number>; phase: string } }>();
		expect(state.state).toMatchObject({ audience: { frozen: true }, audienceDistribution: {}, phase: "reveal" });
	});

	it("preserves pinned Null Pointer answers after arbitrary shard bins saturate", async () => {
		const roomId = `canonical-saturation-${crypto.randomUUID()}`;
		const stub = await room(roomId, "null-pointer");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		for (const [id, answer, teamId] of [["java-answer", "Java", "team-red"], ["elixir-answer", "Elixir", "team-blue"]] as const) {
			await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: { ...principal(`${teamId}-player`, "player", teamId), "content-type": "application/json" }, body: JSON.stringify({ v: 1, id, type: "answer.submit", expectedVersion: id === "java-answer" ? 1 : 2, payload: { answer }, sentAt: new Date().toISOString() }) });
		}
		const saturated = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:30`));
		const submit = (shard: DurableObjectStub, viewer: string, choice: string, commandId: string, shardId: string) => shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal(viewer, "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId, promptId: "null-0", choice, commandId }) });
		for (let index = 0; index < 32; index += 1) expect((await submit(saturated, `filler-viewer-${index}`, `filler-${index}`, `filler-command-${index}`, "30")).status).toBe(202);
		for (let index = 0; index < 100; index += 1) expect((await submit(saturated, `java-viewer-${index}`, index % 2 ? "Java" : "java", `java-command-${index}`, "30")).status).toBe(202);
		const other = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:31`));
		expect((await submit(other, "elixir-viewer", "Elixir", "elixir-command", "31")).status).toBe(202);
		for (let attempt = 0; attempt < 50; attempt += 1) {
			const snapshot = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { private: { audienceCanonicalDistribution?: Record<string, number> } } }>();
			if (snapshot.state.private.audienceCanonicalDistribution?.Java === 100 && snapshot.state.private.audienceCanonicalDistribution?.Elixir === 1) break;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		const beforeFreeze = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> }; audienceDistribution: Record<string, number>; private: { audienceCanonicalDistribution: Record<string, number> } } }>();
		expect(beforeFreeze.state.audienceDistribution).toMatchObject({ Other: 100, Elixir: 1 });
		expect(beforeFreeze.state.private.audienceCanonicalDistribution).toMatchObject({ Java: 100, Elixir: 1 });
		// Each shard remains bounded independently; the second shard contributes
		// one additional canonical bin to the room-wide aggregate.
		expect(Object.keys(beforeFreeze.state.audience.totals)).toHaveLength(34);
		expect(beforeFreeze.state.audience.totals.Other).toBe(100);
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "freeze", type: "audience.freeze", expectedVersion: 3, payload: {}, sentAt: new Date().toISOString() }) });
		const reveal = await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "reveal", type: "prompt.reveal", expectedVersion: 4, payload: {}, sentAt: new Date().toISOString() }) });
		expect((await reveal.json<{ type: string }>()).type).toBe("event");
		const revealed = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { teams: Record<string, { score: number }> } }>();
		expect(revealed.state.teams["team-red"].score).toBe(1);
		expect(revealed.state.teams["team-blue"].score).toBe(100);
	}, 30_000);

	it("keeps private canonical aliases out of snapshots and aggregate frames before reveal", async () => {
		const roomId = `canonical-redaction-${crypto.randomUUID()}`;
		const stub = bindings.GAME_ROOM.get(bindings.GAME_ROOM.idFromName(roomId));
		const content = {
			revisionId: "private-null-revision",
			checksum: "private-null-checksum",
			manifest: { gameContent: { title: "Private Null", rounds: [{ prompt: "Name the hidden runtime", answers: [{ answer: "Secret Runtime", aliases: ["sr"], surveyResponses: 1 }] }] } },
			questions: [],
		};
		await stub.fetch("https://game-room.internal/_internal/init", { method: "POST", body: JSON.stringify({ roomId, gameKey: "null-pointer", content }) });
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: { ...principal("player", "player", "team-red"), "content-type": "application/json" }, body: JSON.stringify({ v: 1, id: "team-answer", type: "answer.submit", expectedVersion: 1, payload: { answer: "Secret Runtime" }, sentAt: new Date().toISOString() }) });
		const shardId = "29";
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:${shardId}`));
		const accepted = await shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal("alias-viewer", "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId, promptId: "null-0", choice: "sr", commandId: "private-alias" }) });
		expect(accepted.status).toBe(202);
		for (let attempt = 0; attempt < 30; attempt += 1) {
			const snapshot = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("display", "display") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
			if (snapshot.state.audience.totals.sr === 1) break;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		const publicSnapshot = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("display", "display") })).text();
		expect(publicSnapshot).toContain('"sr":1');
		expect(publicSnapshot).not.toContain("Secret Runtime");
		const aggregateFrames = await (await shard.fetch("https://audience-shard.internal/_internal/testing/events", { headers: { "x-arcade-test-secret": "test-only-local-secret" } })).text();
		expect(aggregateFrames).toContain('"sr":1');
		expect(aggregateFrames).not.toContain("Secret Runtime");
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "freeze", type: "audience.freeze", expectedVersion: 2, payload: {}, sentAt: new Date().toISOString() }) });
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "reveal", type: "prompt.reveal", expectedVersion: 3, payload: {}, sentAt: new Date().toISOString() }) });
		const revealed = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("display", "display") })).json<{ state: { teams: Record<string, { score: number }>; revealedAnswer?: string } }>();
		expect(revealed.state.teams["team-red"].score).toBe(1);
		expect(revealed.state.revealedAnswer).toContain("Secret Runtime");
	});

	it("projects Principal Engineer lifelines into the public live state", async () => {
		const stub = await room(`principal-lifelines-${crypto.randomUUID()}`, "principal-engineer");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "fifty", type: "principal.lifeline", expectedVersion: 1, payload: { teamId: "team-red", lifeline: "fifty-fifty" }, sentAt: new Date().toISOString() }) });
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "audience", type: "principal.lifeline", expectedVersion: 2, payload: { teamId: "team-red", lifeline: "ask-audience" }, sentAt: new Date().toISOString() }) });
		const aggregate = await stub.fetch("https://game-room.internal/_internal/audience-flush", { method: "POST", headers: { ...principal("audience-shard", "producer"), "content-type": "application/json" }, body: JSON.stringify({ mode: "vote", promptId: "principal-0", shardId: "0", totals: { "2": 3 }, commandIds: [] }) });
		expect(aggregate.status).toBe(200);
		const snapshot = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("display", "display") })).json<{ state: { activePrompt: { choices: Array<{ id: string }> }; principalEngineer: { fiftyFiftyUsed: boolean; askAudienceUsed: boolean; fiftyFiftyActive: boolean; askAudienceActive: boolean; eliminatedChoiceIds: string[]; audienceAdvice: Record<string, number> } } }>();
		expect(snapshot.state.activePrompt.choices).toHaveLength(2);
		expect(snapshot.state.activePrompt.choices.map((choice) => choice.id)).toContain("2");
		expect(snapshot.state.principalEngineer).toMatchObject({ fiftyFiftyUsed: true, askAudienceUsed: true, fiftyFiftyActive: true, askAudienceActive: true, audienceAdvice: { "2": 3 } });
		expect(snapshot.state.principalEngineer.eliminatedChoiceIds).toHaveLength(2);
	});

	it("drains a ballot admitted before freeze exactly once, then rejects late votes", async () => {
		const roomId = `freeze-drain-${crypto.randomUUID()}`;
		const stub = await room(roomId, "null-pointer");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "open", type: "prompt.open", expectedVersion: 0, payload: { id: "freeze-round", prompt: "Pick" }, sentAt: new Date().toISOString() }) });
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:2`));
		const accepted = await shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal("before-freeze", "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "2", promptId: "freeze-round", choice: "Zig", commandId: "pre-freeze" }) });
		expect(accepted.status).toBe(202);
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "freeze", type: "audience.freeze", expectedVersion: 1, payload: {}, sentAt: new Date().toISOString() }) });
		for (let attempt = 0; attempt < 20; attempt += 1) {
			const state = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
			if (state.state.audience.totals.Zig === 1) break;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		const drained = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
		expect(drained.state.audience.totals.Zig).toBe(1);
		const late = await shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal("after-freeze", "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "2", promptId: "freeze-round", choice: "Rust", commandId: "post-freeze" }) });
		expect(late.status).toBe(409);
	});

	it("does not let a same-principal duplicate hold the freeze reveal barrier", async () => {
		const roomId = `freeze-duplicate-${crypto.randomUUID()}`;
		const stub = await room(roomId, "null-pointer");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:4`));
		const submit = (id: string, choice: string) => shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal("same-viewer", "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "4", promptId: "null-0", choice, commandId: id }) });
		expect((await submit("first", "Java")).status).toBe(202);
		expect((await submit("fresh-duplicate", "Rust")).status).toBe(202);
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "freeze", type: "audience.freeze", expectedVersion: 1, payload: {}, sentAt: new Date().toISOString() }) });
		for (let attempt = 0; attempt < 20; attempt += 1) {
			const state = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
			if (state.state.audience.totals.Java === 1) break;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		const reveal = await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "reveal", type: "prompt.reveal", expectedVersion: 2, payload: {}, sentAt: new Date().toISOString() }) });
		expect((await reveal.json<{ type: string }>()).type).toBe("event");
		const state = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
		expect(state.state.audience.totals).toEqual({ Java: 1 });
	});

	it("keeps the first admission when two principals reuse one command ID", async () => {
		const roomId = `freeze-shared-command-${crypto.randomUUID()}`;
		const stub = await room(roomId, "null-pointer");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:5`));
		const submit = (viewer: string, choice: string) => shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal(viewer, "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "5", promptId: "null-0", choice, commandId: "shared-command" }) });
		const [first, duplicate] = await Promise.all([submit("viewer-a", "Go"), submit("viewer-b", "Rust")]);
		expect(first.status).toBe(202); expect(duplicate.status).toBe(202);
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "freeze", type: "audience.freeze", expectedVersion: 1, payload: {}, sentAt: new Date().toISOString() }) });
		for (let attempt = 0; attempt < 20; attempt += 1) {
			const state = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
			if (Object.values(state.state.audience.totals).reduce((total, value) => total + value, 0) === 1) break;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		const reveal = await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "reveal", type: "prompt.reveal", expectedVersion: 2, payload: {}, sentAt: new Date().toISOString() }) });
		expect((await reveal.json<{ type: string }>()).type).toBe("event");
		const state = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
		expect(Object.values(state.state.audience.totals).reduce((total, value) => total + value, 0)).toBe(1);
	});

	it("delivers a public audience snapshot without producer-only data", async () => {
		const stub = await room(`audience-${crypto.randomUUID()}`, "null-pointer");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "prompt", type: "prompt.open", expectedVersion: 0, payload: { id: "prompt-public", prompt: "Pick a command", choices: [{ id: "git-blame", label: "git blame" }], answer: "private-answer", e2ePrivateMarker: "private-marker" }, sentAt: new Date().toISOString() }) });
		const response = await stub.fetch("https://game-room.internal/_internal/audience-register", { method: "POST", headers: { "content-type": "application/json", ...principal("shard", "producer") }, body: JSON.stringify({ shardId: "0" }) });
		const snapshot = await response.json<{ type: string; state: Record<string, unknown> }>();
		expect(snapshot.type).toBe("snapshot");
		expect(JSON.stringify(snapshot.state)).toContain("git-blame");
		expect(JSON.stringify(snapshot.state)).not.toContain("private-answer");
		expect(JSON.stringify(snapshot.state)).not.toContain("private-marker");
	});

	it("projects public round and audience-presence metadata without identities", async () => {
		const stub = await room(`public-metadata-${crypto.randomUUID()}`, "null-pointer");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "open", type: "prompt.open", expectedVersion: 0, payload: { id: "round-7", prompt: "Public round" }, sentAt: new Date().toISOString() }) });
		await stub.fetch("https://game-room.internal/_internal/audience-presence", { method: "POST", headers: { ...principal("shard", "producer"), "content-type": "application/json" }, body: JSON.stringify({ shardId: "3", principalId: "audience-secret-id", connected: true }) });
		const snapshot = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("display", "display") })).json<{ state: { audienceCount: number; round: { id: string; phase: string } } }>();
		expect(snapshot.state.audienceCount).toBe(1);
		expect(snapshot.state.round).toMatchObject({ id: "round-7", phase: "question" });
		expect(JSON.stringify(snapshot.state)).not.toContain("audience-secret-id");
	});

	it("does not let a delayed presence body overwrite a newer gameplay state", async () => {
		const stub = await room(`presence-overlap-${crypto.randomUUID()}`, "merge-conflict");
		const stream = new TransformStream<Uint8Array, Uint8Array>();
		const writer = stream.writable.getWriter();
		const encoder = new TextEncoder();
		const presence = stub.fetch("https://game-room.internal/_internal/audience-presence", { method: "POST", headers: { ...principal("shard", "producer"), "content-type": "application/json" }, body: stream.readable });
		await writer.write(encoder.encode('{"shardId":"held","principalId":"viewer",'));
		await new Promise((resolve) => setTimeout(resolve, 20));
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: { ...principal("host", "host"), "content-type": "application/json" }, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		await writer.write(encoder.encode('"connected":true}'));
		await writer.close();
		expect((await presence).status).toBe(200);
		const snapshot = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { status: string; version: number; audienceCount: number } }>();
		expect(snapshot.state).toMatchObject({ status: "live", version: 1, audienceCount: 1 });
	});

	it("evaluates delayed audience admission against the post-freeze state", async () => {
		const stub = await room(`admission-overlap-${crypto.randomUUID()}`, "null-pointer");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		const stream = new TransformStream<Uint8Array, Uint8Array>();
		const writer = stream.writable.getWriter();
		const encoder = new TextEncoder();
		const admission = stub.fetch("https://game-room.internal/_internal/audience-submit", { method: "POST", headers: { ...principal("shard", "producer"), "content-type": "application/json" }, body: stream.readable });
		await writer.write(encoder.encode('{"promptId":"null-0","commandId":"held",'));
		await new Promise((resolve) => setTimeout(resolve, 20));
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "freeze", type: "audience.freeze", expectedVersion: 1, payload: {}, sentAt: new Date().toISOString() }) });
		await writer.write(encoder.encode('"shardId":"held-shard"}'));
		await writer.close();
		expect((await admission).status).toBe(409);
	});

	it("flushes sustained reaction commands in bounded correlated batches", async () => {
		const roomId = `reaction-load-${crypto.randomUUID()}`;
		await room(roomId, "merge-conflict");
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:9`));
		for (let index = 0; index < 125; index += 1) {
			const response = await shard.fetch("https://audience-shard.internal/_internal/submit-reaction", { method: "POST", headers: { ...principal(`viewer-${index}`, "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "9", promptId: "load-round", reaction: "ship-it", commandId: `reaction-${index}` }) });
			expect(response.status).toBe(202);
		}
		const game = bindings.GAME_ROOM.get(bindings.GAME_ROOM.idFromName(roomId));
		for (let attempt = 0; attempt < 30; attempt += 1) {
			const state = await (await game.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { reactions: Record<string, number> } } }>();
			if (state.state.audience.reactions["ship-it"] === 125) break;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		const state = await (await game.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { reactions: Record<string, number> } } }>();
		expect(state.state.audience.reactions["ship-it"]).toBe(125);
		const frames = await (await shard.fetch("https://audience-shard.internal/_internal/testing/events", { headers: { "x-arcade-test-secret": "test-only-local-secret" } })).json<{ events: Array<{ payload: { commandIds: string[] } }> }>();
		const ids = frames.events.flatMap((frame) => frame.payload.commandIds);
		expect(frames.events.every((frame) => frame.payload.commandIds.length <= 100)).toBe(true);
		expect(ids).toHaveLength(125);
		expect(new Set(ids).size).toBe(125);
		expect(new Set(ids)).toEqual(new Set(Array.from({ length: 125 }, (_, index) => `reaction-${index}`)));
	});

	it("coalesces high-cardinality audience answers before room-state persistence", async () => {
		const roomId = `bounded-votes-${crypto.randomUUID()}`;
		const stub = await room(roomId, "null-pointer");
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: { ...principal("host", "host"), "content-type": "application/json" }, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:24`));
		for (let index = 0; index < 34; index += 1) {
			const choice = `${String(index).padStart(2, "0")}-${"x".repeat(97)}`;
			const response = await shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal(`bounded-${index}`, "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "24", promptId: "null-0", choice, commandId: `bounded-${index}` }) });
			expect(response.status).toBe(202);
		}
		for (let attempt = 0; attempt < 30; attempt += 1) {
			const state = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
			if (Object.values(state.state.audience.totals).reduce((sum, total) => sum + total, 0) === 34) break;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		const state = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
		expect(Object.keys(state.state.audience.totals)).toHaveLength(33);
		expect(state.state.audience.totals.Other).toBe(2);
		expect(Object.values(state.state.audience.totals).reduce((sum, total) => sum + total, 0)).toBe(34);
	});

	it("keeps a host command version valid while audience projections flush", async () => {
		const roomId = `version-churn-${crypto.randomUUID()}`;
		const stub = await room(roomId, "merge-conflict");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "open", type: "prompt.open", expectedVersion: 0, payload: { id: "churn-round", prompt: "Question" }, sentAt: new Date().toISOString() }) });
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:11`));
		for (let index = 0; index < 32; index += 1) await shard.fetch("https://audience-shard.internal/_internal/submit-reaction", { method: "POST", headers: { ...principal(`churn-${index}`, "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "11", promptId: "churn-round", reaction: "like", commandId: `churn-${index}` }) });
		await new Promise((resolve) => setTimeout(resolve, 200));
		const hostCommand = await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start-after-churn", type: "room.start", expectedVersion: 1, payload: {}, sentAt: new Date().toISOString() }) });
		expect((await hostCommand.json<{ type: string }>()).type).toBe("event");
	});

	it("recovers a coordinator admission when the shard loses its first response", async () => {
		const roomId = `admission-recovery-${crypto.randomUUID()}`;
		const stub = await room(roomId, "null-pointer");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:12`));
		await shard.fetch("https://audience-shard.internal/_internal/testing/fail-next-admission-response", { method: "POST", headers: { "x-arcade-test-secret": "test-only-local-secret" } });
		const accepted = await shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal("interrupted-viewer", "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "12", promptId: "null-0", choice: "Zig", commandId: "lost-response" }) });
		expect(accepted.status).toBe(202);
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "freeze", type: "audience.freeze", expectedVersion: 1, payload: {}, sentAt: new Date().toISOString() }) });
		for (let attempt = 0; attempt < 30; attempt += 1) {
			const state = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
			if (state.state.audience.totals.Zig === 1) break;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		const drained = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
		expect(drained.state.audience.totals.Zig).toBe(1);
		const reveal = await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "reveal", type: "prompt.reveal", expectedVersion: 2, payload: {}, sentAt: new Date().toISOString() }) });
		expect((await reveal.json<{ type: string }>()).type).toBe("event");
	});

	it("recovers a locally durable ballot when an identical retry sees its claim", async () => {
		const roomId = `local-intent-recovery-${crypto.randomUUID()}`;
		const stub = await room(roomId, "null-pointer");
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: { ...principal("host", "host"), "content-type": "application/json" }, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:19`));
		await shard.fetch("https://audience-shard.internal/_internal/testing/interrupt-next-local-vote", { method: "POST", headers: { "x-arcade-test-secret": "test-only-local-secret" } });
		const request = { roomId, shardId: "19", promptId: "null-0", choice: "Java", commandId: "local-retry" };
		const interrupted = await shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal("local-viewer", "audience"), "content-type": "application/json" }, body: JSON.stringify(request) });
		expect(interrupted.status).toBe(202);
		const duplicate = await shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal("local-viewer", "audience"), "content-type": "application/json" }, body: JSON.stringify(request) });
		expect(await duplicate.json<{ duplicate?: boolean }>()).toMatchObject({ duplicate: true });
		for (let attempt = 0; attempt < 30; attempt += 1) {
			const state = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
			if (state.state.audience.totals.Java === 1) break;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		const recovered = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
		expect(recovered.state.audience.totals.Java).toBe(1);
	});

	it("commits one ballot when alarm recovery overlaps a delayed original response", async () => {
		const roomId = `admission-overlap-${crypto.randomUUID()}`;
		const stub = await room(roomId, "null-pointer");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		await stub.fetch("https://game-room.internal/_internal/testing/delay-next-audience-admission", { method: "POST", headers: { "x-arcade-test-secret": "test-only-local-secret" } });
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:14`));
		let originalSettled = false;
		const original = shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal("overlap-viewer", "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "14", promptId: "null-0", choice: "Java", commandId: "overlap-vote" }) }).finally(() => { originalSettled = true; });
		for (let attempt = 0; attempt < 8; attempt += 1) {
			const state = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
			if (state.state.audience.totals.Java === 1) break;
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		expect(originalSettled).toBe(false);
		expect((await original).status).toBe(202);
		await new Promise((resolve) => setTimeout(resolve, 150));
		const recovered = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
		expect(recovered.state.audience.totals.Java).toBe(1);
	});

	it("rejects cross-prompt command reuse without replacing a delayed vote intent", async () => {
		const roomId = `admission-binding-${crypto.randomUUID()}`;
		const stub = await room(roomId, "null-pointer");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		await stub.fetch("https://game-room.internal/_internal/testing/delay-next-audience-admission", { method: "POST", headers: { "x-arcade-test-secret": "test-only-local-secret" } });
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:18`));
		const first = shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal("binding-viewer", "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "18", promptId: "null-0", choice: "Java", commandId: "bound-id" }) });
		await new Promise((resolve) => setTimeout(resolve, 25));
		const conflicting = await shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal("binding-viewer", "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "18", promptId: "other-prompt", choice: "Rust", commandId: "bound-id" }) });
		expect(conflicting.status).toBe(409);
		expect((await conflicting.json<{ error: { code: string } }>()).error.code).toBe("COMMAND_ID_CONFLICT");
		expect((await first).status).toBe(202);
		for (let attempt = 0; attempt < 30; attempt += 1) {
			const state = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
			if (state.state.audience.totals.Java === 1) break;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "freeze", type: "audience.freeze", expectedVersion: 1, payload: {}, sentAt: new Date().toISOString() }) });
		const reveal = await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "reveal", type: "prompt.reveal", expectedVersion: 2, payload: {}, sentAt: new Date().toISOString() }) });
		expect((await reveal.json<{ type: string }>()).type).toBe("event");
	});

	it("does not let a delayed original response claim a replacement prompt intent", async () => {
		const roomId = `admission-generation-${crypto.randomUUID()}`;
		const stub = await room(roomId, "null-pointer");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		await stub.fetch("https://game-room.internal/_internal/testing/delay-next-audience-admission", { method: "POST", headers: { "x-arcade-test-secret": "test-only-local-secret" } });
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:23`));
		let originalSettled = false;
		const originalIntent = { roomId, shardId: "23", promptId: "null-0", choice: "Java", commandId: "generation-id" };
		const original = shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal("generation-a", "audience"), "content-type": "application/json" }, body: JSON.stringify(originalIntent) }).finally(() => { originalSettled = true; });
		for (let attempt = 0; attempt < 20; attempt += 1) {
			const state = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
			const pending = await (await shard.fetch("https://audience-shard.internal/_internal/testing/pending", { headers: { "x-arcade-test-secret": "test-only-local-secret" } })).json<{ pendingFlushes: number; pendingAcks: number; intents: number }>();
			if (state.state.audience.totals.Java === 1 && pending.pendingFlushes === 0 && pending.pendingAcks === 0 && pending.intents === 0) break;
			await new Promise((resolve) => setTimeout(resolve, 25));
		}
		expect(originalSettled).toBe(false);
		const drained = await (await shard.fetch("https://audience-shard.internal/_internal/testing/pending", { headers: { "x-arcade-test-secret": "test-only-local-secret" } })).json<{ pendingFlushes: number; pendingAcks: number; intents: number }>();
		expect(drained).toMatchObject({ pendingFlushes: 0, pendingAcks: 0, intents: 0 });
		for (let delay = 0; delay < 2; delay += 1) await stub.fetch("https://game-room.internal/_internal/testing/delay-next-before-audience-admission", { method: "POST", headers: { "x-arcade-test-secret": "test-only-local-secret" } });
		const replacement = shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal("generation-b", "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "23", promptId: "other-prompt", choice: "Rust", commandId: "generation-id" }) });
		expect((await original).status).toBe(202);
		const replacementResponse = await replacement;
		expect(replacementResponse.status).toBe(409);
		expect((await replacementResponse.json<{ error: { code: string } }>()).error.code).toBe("COMMAND_ID_CONFLICT");
		await new Promise((resolve) => setTimeout(resolve, 150));
		const final = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
		expect(final.state.audience.totals).toEqual({ Java: 1 });
	});

	it("keeps a committed admission tombstone when recovery overtakes the original request", async () => {
		const roomId = `admission-overtake-${crypto.randomUUID()}`;
		const stub = await room(roomId, "null-pointer");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		await stub.fetch("https://game-room.internal/_internal/testing/delay-next-before-audience-admission", { method: "POST", headers: { "x-arcade-test-secret": "test-only-local-secret" } });
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:20`));
		const original = shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal("overtake-viewer", "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "20", promptId: "null-0", choice: "Java", commandId: "overtaken" }) });
		expect((await original).status).toBe(202);
		for (let attempt = 0; attempt < 30; attempt += 1) {
			const state = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
			if (state.state.audience.totals.Java === 1) break;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "freeze", type: "audience.freeze", expectedVersion: 1, payload: {}, sentAt: new Date().toISOString() }) });
		const reveal = await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "reveal", type: "prompt.reveal", expectedVersion: 2, payload: {}, sentAt: new Date().toISOString() }) });
		expect((await reveal.json<{ type: string }>()).type).toBe("event");
	});

	it("does not let a reaction acknowledgement clear a pending vote admission", async () => {
		const roomId = `mode-scope-${crypto.randomUUID()}`;
		const stub = await room(roomId, "null-pointer");
		const producerHeaders = { ...principal("shard", "producer"), "content-type": "application/json" };
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		const admitted = await stub.fetch("https://game-room.internal/_internal/audience-submit", { method: "POST", headers: producerHeaders, body: JSON.stringify({ promptId: "null-0", commandId: "shared-id", shardId: "15" }) });
		expect(admitted.status).toBe(202);
		await stub.fetch("https://game-room.internal/_internal/audience-flush", { method: "POST", headers: producerHeaders, body: JSON.stringify({ mode: "reaction", promptId: "null-0", shardId: "15", reactions: { like: 1 }, commandIds: ["shared-id"] }) });
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "freeze", type: "audience.freeze", expectedVersion: 1, payload: {}, sentAt: new Date().toISOString() }) });
		const blocked = await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "blocked-reveal", type: "prompt.reveal", expectedVersion: 2, payload: {}, sentAt: new Date().toISOString() }) });
		expect((await blocked.json<{ code?: string }>()).code).toBe("CONFLICT");
		await stub.fetch("https://game-room.internal/_internal/audience-flush", { method: "POST", headers: producerHeaders, body: JSON.stringify({ mode: "vote", promptId: "null-0", shardId: "15", totals: { Java: 1 }, commandIds: ["shared-id"], admissionVersion: 1 }) });
		const reveal = await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "reveal", type: "prompt.reveal", expectedVersion: 2, payload: {}, sentAt: new Date().toISOString() }) });
		expect((await reveal.json<{ type: string }>()).type).toBe("event");
	});

	it("keeps shard vote recovery separate from a reaction with the same command ID", async () => {
		const roomId = `shard-mode-scope-${crypto.randomUUID()}`;
		const stub = await room(roomId, "null-pointer");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		for (let failure = 0; failure < 2; failure += 1) await stub.fetch("https://game-room.internal/_internal/testing/fail-next-audience-admission", { method: "POST", headers: { "x-arcade-test-secret": "test-only-local-secret" } });
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:16`));
		const vote = await shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal("mode-viewer", "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "16", promptId: "null-0", choice: "Java", commandId: "shared-mode-id" }) });
		expect(vote.status).toBe(503);
		const reaction = await shard.fetch("https://audience-shard.internal/_internal/submit-reaction", { method: "POST", headers: { ...principal("mode-viewer", "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "16", promptId: "null-0", reaction: "like", commandId: "shared-mode-id" }) });
		expect(reaction.status).toBe(202);
		for (let attempt = 0; attempt < 30; attempt += 1) {
			const state = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number>; reactions: Record<string, number> } } }>();
			if (state.state.audience.totals.Java === 1 && state.state.audience.reactions.like === 1) break;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		const recovered = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number>; reactions: Record<string, number> } } }>();
		expect(recovered.state.audience.totals.Java).toBe(1);
		expect(recovered.state.audience.reactions.like).toBe(1);
	});

	it("finalizes a permanently rejected reaction without an alarm retry loop", async () => {
		const roomId = `terminal-reaction-${crypto.randomUUID()}`;
		const now = new Date().toISOString();
		await bindings.DB.prepare("INSERT INTO arcade_room_directory (id, game_key, content_revision_id, title, status, created_by, created_at, updated_at) VALUES (?, ?, NULL, ?, 'lobby', NULL, ?, ?)").bind(roomId, "null-pointer", "terminal reaction cleanup", now, now).run();
		const stub = await room(roomId, "null-pointer");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "freeze", type: "audience.freeze", expectedVersion: 1, payload: {}, sentAt: new Date().toISOString() }) });
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "complete", type: "room.complete", expectedVersion: 2, payload: {}, sentAt: new Date().toISOString() }) });
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:21`));
		const reaction = await shard.fetch("https://audience-shard.internal/_internal/submit-reaction", { method: "POST", headers: { ...principal("late-reactor", "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "21", promptId: "null-0", reaction: "like", commandId: "terminal-reaction" }) });
		expect(reaction.status).toBe(202);
		for (let attempt = 0; attempt < 30; attempt += 1) {
			const pending = await (await shard.fetch("https://audience-shard.internal/_internal/testing/pending", { headers: { "x-arcade-test-secret": "test-only-local-secret" } })).json<{ pendingFlushes: number; pendingAcks: number; alarm: number | null }>();
			if (pending.pendingFlushes === 0 && pending.pendingAcks === 0 && pending.alarm === null) break;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		const pending = await (await shard.fetch("https://audience-shard.internal/_internal/testing/pending", { headers: { "x-arcade-test-secret": "test-only-local-secret" } })).json<{ pendingFlushes: number; pendingAcks: number; alarm: number | null }>();
		expect(pending).toMatchObject({ pendingFlushes: 0, pendingAcks: 0, alarm: null });
	});

	it("finalizes an old-prompt vote instead of retrying its stale flush forever", async () => {
		const roomId = `stale-vote-${crypto.randomUUID()}`;
		const stub = await room(roomId, "merge-conflict");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:22`));
		await shard.fetch("https://audience-shard.internal/_internal/testing/fail-next-flush", { method: "POST", headers: { "x-arcade-test-secret": "test-only-local-secret" } });
		const vote = await shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal("stale-viewer", "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "22", promptId: "merge-0", choice: "Git blame", commandId: "stale-vote" }) });
		expect(vote.status).toBe(202);
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "advance", type: "phase.advance", expectedVersion: 1, payload: {}, sentAt: new Date().toISOString() }) });
		for (let attempt = 0; attempt < 30; attempt += 1) {
			const pending = await (await shard.fetch("https://audience-shard.internal/_internal/testing/pending", { headers: { "x-arcade-test-secret": "test-only-local-secret" } })).json<{ pendingFlushes: number; pendingAcks: number; pendingIntents: number; alarm: number | null }>();
			if (pending.pendingFlushes === 0 && pending.pendingAcks === 0 && pending.pendingIntents === 0 && pending.alarm === null) break;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		const pending = await (await shard.fetch("https://audience-shard.internal/_internal/testing/pending", { headers: { "x-arcade-test-secret": "test-only-local-secret" } })).json<{ pendingFlushes: number; pendingAcks: number; pendingIntents: number; alarm: number | null }>();
		expect(pending).toMatchObject({ pendingFlushes: 0, pendingAcks: 0, pendingIntents: 0, alarm: null });
	});

	it("retries a durable audience intent when the coordinator fails before admission", async () => {
		const roomId = `admission-precommit-${crypto.randomUUID()}`;
		const stub = await room(roomId, "null-pointer");
		const hostHeaders = { ...principal("host", "host"), "content-type": "application/json" };
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		await stub.fetch("https://game-room.internal/_internal/testing/fail-next-audience-admission", { method: "POST", headers: { "x-arcade-test-secret": "test-only-local-secret" } });
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:13`));
		const unavailable = await shard.fetch("https://audience-shard.internal/_internal/submit", { method: "POST", headers: { ...principal("retry-viewer", "audience"), "content-type": "application/json" }, body: JSON.stringify({ roomId, shardId: "13", promptId: "null-0", choice: "Java", commandId: "precommit-retry" }) });
		expect(unavailable.status).toBe(503);
		for (let attempt = 0; attempt < 30; attempt += 1) {
			const state = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
			if (state.state.audience.totals.Java === 1) break;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		const recovered = await (await stub.fetch("https://game-room.internal/_internal/state", { headers: principal("host", "host") })).json<{ state: { audience: { totals: Record<string, number> } } }>();
		expect(recovered.state.audience.totals.Java).toBe(1);
		const freeze = await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "freeze", type: "audience.freeze", expectedVersion: 1, payload: {}, sentAt: new Date().toISOString() }) });
		expect((await freeze.json<{ type: string }>()).type).toBe("event");
		const reveal = await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: hostHeaders, body: JSON.stringify({ v: 1, id: "reveal", type: "prompt.reveal", expectedVersion: 2, payload: {}, sentAt: new Date().toISOString() }) });
		expect((await reveal.json<{ type: string }>()).type).toBe("event");
	});

	it("projects a terminal intent after interruption before external delivery", async () => {
		const roomId = `terminal-interruption-${crypto.randomUUID()}`;
		const now = new Date().toISOString();
		await bindings.DB.prepare("INSERT INTO arcade_room_directory (id, game_key, content_revision_id, title, status, created_by, created_at, updated_at) VALUES (?, ?, NULL, ?, 'lobby', NULL, ?, ?)").bind(roomId, "spinlock", "terminal interruption", now, now).run();
		const stub = await room(roomId, "spinlock");
		await stub.fetch("https://game-room.internal/_internal/testing/fail-next-terminal-delivery", { method: "POST", headers: { "x-arcade-test-secret": "test-only-local-secret" } });
		const completion = await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: { ...principal("host", "host"), "content-type": "application/json" }, body: JSON.stringify({ v: 1, id: "complete", type: "room.complete", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		expect((await completion.json<{ type: string }>()).type).toBe("event");
		for (let attempt = 0; attempt < 30; attempt += 1) {
			const projected = await bindings.DB.prepare("SELECT COUNT(*) AS count FROM arcade_completed_games WHERE room_id = ?").bind(roomId).first<{ count: number }>();
			if ((projected?.count ?? 0) === 1) break;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		const projected = await bindings.DB.prepare("SELECT COUNT(*) AS count FROM arcade_completed_games WHERE room_id = ?").bind(roomId).first<{ count: number }>();
		expect(projected?.count).toBe(1);
	});

	it("retries a failed terminal snapshot fanout with a higher delivery sequence", async () => {
		const roomId = `terminal-fanout-${crypto.randomUUID()}`;
		const now = new Date().toISOString();
		await bindings.DB.prepare("INSERT INTO arcade_room_directory (id, game_key, content_revision_id, title, status, created_by, created_at, updated_at) VALUES (?, ?, NULL, ?, 'lobby', NULL, ?, ?)").bind(roomId, "spinlock", "terminal fanout", now, now).run();
		const stub = await room(roomId, "spinlock");
		const shardId = "17";
		const shard = bindings.AUDIENCE_SHARD.get(bindings.AUDIENCE_SHARD.idFromName(`${roomId}:audience:${shardId}`));
		const connection = await shard.fetch("https://audience-shard.internal/_internal/connect", {
			headers: {
				...principal("fanout-viewer", "audience"),
				upgrade: "websocket",
				"x-arcade-room-id": roomId,
				"x-arcade-shard-id": shardId,
				"x-arcade-ticket-nonce": `fanout-${crypto.randomUUID()}`,
			},
		});
		expect(connection.status).toBe(101);
		const socket = connection.webSocket!;
		socket.accept();
		const initial = await waitForSocketMessage(socket, (message) => message.type === "snapshot");
		await shard.fetch("https://audience-shard.internal/_internal/testing/fail-next-public-update", { method: "POST", headers: { "x-arcade-test-secret": "test-only-local-secret" } });
		await stub.fetch("https://game-room.internal/_internal/command", { method: "POST", headers: { ...principal("host", "host"), "content-type": "application/json" }, body: JSON.stringify({ v: 1, id: "complete", type: "room.complete", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
		const terminal = await waitForSocketMessage(socket, (message) => message.type === "snapshot" && (message.state as { status?: string })?.status === "complete");
		expect(Number(terminal.deliverySequence)).toBeGreaterThan(Number(initial.deliverySequence));
		socket.close(1000, "done");
	});
});
