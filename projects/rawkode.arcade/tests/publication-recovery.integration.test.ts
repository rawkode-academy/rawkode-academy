import { env, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { beforeAll, expect, it } from "vitest";
import type { Env } from "../src/env";
import { migrateTestDatabase } from "./setup-d1";

const bindings = env as unknown as Env;
beforeAll(migrateTestDatabase);

it("acknowledges a committed command before D1 projection and recovers it by alarm", async () => {
	const roomId = `deferred-publication-${crypto.randomUUID()}`;
	const room = bindings.GAME_ROOM.get(bindings.GAME_ROOM.idFromName(roomId));
	await room.fetch("https://room/_internal/init", { method: "POST", body: JSON.stringify({ roomId, gameKey: "spinlock" }) });
	const response = await room.fetch("https://room/_internal/command", {
		method: "POST",
		headers: { "x-arcade-principal": JSON.stringify({ id: "host", role: "host" }) },
		body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }),
	});
	expect(await response.json()).toMatchObject({ type: "event", version: 1, commandId: "start" });
	await runInDurableObject(room, async (_instance, state) => {
		// A wake-up is durable even if the request process vanishes immediately
		// after acknowledging; no fire-and-forget fetch is needed for recovery.
		expect(await state.storage.getAlarm()).not.toBeNull();
		expect([...state.storage.sql.exec("SELECT id FROM commands WHERE id = 'start'")]).toHaveLength(1);
	});
	await runDurableObjectAlarm(room);
	const projected = await bindings.DB.prepare("SELECT COUNT(*) AS count FROM arcade_room_outbox WHERE room_id = ? AND kind = 'room.start'").bind(roomId).first<{ count: number }>();
	expect(projected?.count).toBe(1);
});

it("compacts expired tickets and old committed admissions without dropping pending admissions", async () => {
	const roomId = `history-retention-${crypto.randomUUID()}`;
	const room = bindings.GAME_ROOM.get(bindings.GAME_ROOM.idFromName(roomId));
	await room.fetch("https://room/_internal/init", { method: "POST", body: JSON.stringify({ roomId, gameKey: "spinlock" }) });
	await room.fetch("https://room/_internal/command", {
		method: "POST", headers: { "x-arcade-principal": JSON.stringify({ id: "host", role: "host" }) },
		body: JSON.stringify({ v: 1, id: "start", type: "room.start", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }),
	});
	await runInDurableObject(room, async (_instance, state) => {
		state.storage.sql.exec("INSERT INTO used_tickets (nonce, used_at) VALUES ('expired', ?), ('valid', ?)", new Date(Date.now() - 11 * 60_000).toISOString(), new Date().toISOString());
		state.storage.sql.exec("INSERT INTO audience_admission_intents (admission_key,command_id,prompt_id,admission_version,shard_id,committed) VALUES ('done','done','old',0,'0',1), ('pending','pending','old',0,'0',0)");
	});
	await runDurableObjectAlarm(room);
	await runInDurableObject(room, async (_instance, state) => {
		expect([...state.storage.sql.exec<{ nonce: string }>("SELECT nonce FROM used_tickets")].map((row) => row.nonce)).toEqual(["valid"]);
		expect([...state.storage.sql.exec<{ command_id: string }>("SELECT command_id FROM audience_admission_intents")].map((row) => row.command_id)).toEqual(["pending"]);
	});
});

it("archives terminal recovery state after 24 hours without making the room reusable", async () => {
	const roomId = `terminal-retention-${crypto.randomUUID()}`;
	const now = new Date().toISOString();
	await bindings.DB.prepare("INSERT INTO arcade_room_directory (id, game_key, title, status, created_at, updated_at) VALUES (?, 'spinlock', 'Retention test', 'lobby', ?, ?)").bind(roomId, now, now).run();
	const room = bindings.GAME_ROOM.get(bindings.GAME_ROOM.idFromName(roomId));
	const headers = { "x-arcade-principal": JSON.stringify({ id: "host", role: "host" }) };
	await room.fetch("https://room/_internal/init", { method: "POST", body: JSON.stringify({ roomId, gameKey: "spinlock" }) });
	await room.fetch("https://room/_internal/command", { method: "POST", headers, body: JSON.stringify({ v: 1, id: "finish", type: "room.complete", expectedVersion: 0, payload: {}, sentAt: new Date().toISOString() }) });
	await runDurableObjectAlarm(room);
	await runInDurableObject(room, async (_instance, state) => {
		expect(await state.storage.getAlarm()).not.toBeNull();
		state.storage.sql.exec("UPDATE room_retention SET expires_at = ? WHERE id = 1", Date.now() - 1);
	});
	await runDurableObjectAlarm(room);
	const snapshot = await (await room.fetch("https://room/_internal/state", { headers })).json<{ state: { status: string; private: unknown; teams: unknown } }>();
	expect(snapshot.state.status).toBe("complete");
	expect(snapshot.state.private).toEqual({});
	expect(Object.keys(snapshot.state.teams as object)).toHaveLength(2);
	const restart = await room.fetch("https://room/_internal/command", { method: "POST", headers, body: JSON.stringify({ v: 1, id: "restart", type: "room.start", expectedVersion: 1, payload: {}, sentAt: new Date().toISOString() }) });
	expect(await restart.json()).toMatchObject({ type: "error", code: "FORBIDDEN" });
});
