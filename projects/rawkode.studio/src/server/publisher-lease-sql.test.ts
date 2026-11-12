import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioEnv } from "../env";
import { confirmStudioStream, endStudioSession, getStudioTakeoverRecovery, startStudioStream, stopStudioStream, takeOverStudioStream } from "./operations";
import { reapWhipProviderAttempts, getWhipTakeoverState, markWhipCreateDispatched, reserveWhipProviderAttempt } from "./whip-provider-lifecycle";
import {
	cancelStudioStreamAttempt,
	claimStudioStreamNotification,
	claimStudioStreamStart,
	expireStaleStudioStreams,
	getPublicStudioShowLineup,
	getStudioStreamTakeoverObservation,
	getStudioSession,
	saveStudioStreamHeartbeat,
	saveStudioStreamLive,
	saveStudioStreamStart,
	takeOverStudioStreamLease,
} from "./studio";

const now = 1_800_000_000;
const migrations = [
	"0000_studio_sessions.sql",
	"0001_content_video_sessions.sql",
	"0002_content_video_slugs.sql",
	"0003_stream_state.sql",
	"0004_participant_provisioning.sql",
	"0004_studio_control_state.sql",
	"0005_stream_publisher_lease.sql",
	"0006_realtimekit_participant_identity.sql",
	"0007_recording_lease.sql",
	"0008_canonical_vod_recording.sql",
	"0009_stream_output_inputs.sql",
	"0010_stream_cancelled_attempts.sql",
	"0011_whip_provider_lifecycle.sql",
];
const databases: DatabaseSync[] = [];
const operator = {
	id: "operator",
	email: "operator@example.test",
	image: null,
	name: "Operator",
	username: "operator",
};

function providerResponse(uid: string): Response {
	return new Response(JSON.stringify({
		success: true,
		result: {
			uid,
			status: "connected",
			webRTC: { url: `https://stream.example/${uid}/publish` },
			webRTCPlayback: { url: `https://stream.example/${uid}/play` },
		},
	}));
}

function createDatabase(
	omitCancellationMigration = false,
	onBeforeRun?: (sql: string) => Promise<void>,
	options: {
		clock?: () => number;
		skipWhipMigration?: boolean;
		onAfterRun?: (sql: string) => Promise<void>;
		onAfterFirst?: (sql: string) => Promise<void>;
		onBeforeBatch?: (sql: string[]) => Promise<void>;
		onBatchStep?: (index: number) => void;
	} = {},
): { sqlite: DatabaseSync; env: StudioEnv } {
	const sqlite = new DatabaseSync(":memory:");
	databases.push(sqlite);
	sqlite.exec("PRAGMA foreign_keys = ON");
	sqlite.function("unixepoch", options.clock ?? (() => now));
	for (const migration of migrations) {
		if (omitCancellationMigration && migration.startsWith("0010_")) continue;
		if (options.skipWhipMigration && migration.startsWith("0011_")) continue;
		sqlite.exec(readFileSync(new URL(`../../data-model/${migration}`, import.meta.url), "utf8"));
	}
	if (!options.skipWhipMigration) sqlite.exec(`UPDATE studio_whip_provider_readiness SET production_ready = 1,
		provider_account_id = 'account', verified_by = 'test', evidence_reference = 'fixture', verified_at = 1`);
	function statement(sql: string, values: SQLInputValue[] = []) {
		return {
			sql,
			values,
			bind: (...params: SQLInputValue[]) => statement(sql, params),
			first: async () => {
				const result = sqlite.prepare(sql).get(...values) ?? null;
				if (options.onAfterFirst) await options.onAfterFirst(sql);
				return result;
			},
			all: async () => ({ results: sqlite.prepare(sql).all(...values) }),
			run: async () => {
				if (onBeforeRun) await onBeforeRun(sql);
				const result = { meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } };
				if (options.onAfterRun) await options.onAfterRun(sql);
				return result;
			},
		};
	}
	const d1 = {
		prepare: (sql: string) => statement(sql),
		batch: async (statements: Array<ReturnType<typeof statement>>) => {
			if (options.onBeforeBatch) await options.onBeforeBatch(statements.map((statement) => statement.sql));
			sqlite.exec("BEGIN");
			try {
				const results = statements.map(({ sql, values }, index) => {
					const result = { meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } };
					options.onBatchStep?.(index);
					return result;
				});
				sqlite.exec("COMMIT");
				return results;
			} catch (error) {
				sqlite.exec("ROLLBACK");
				throw error;
			}
		},
	} as unknown as D1Database;
	return { sqlite, env: { STUDIO_DB: d1 } as StudioEnv };
}

function insertSession(
	sqlite: DatabaseSync,
	id: string,
	streamStatus: "ended" | "idle" | "starting" | "live",
	streamToken: string | null,
	heartbeat: number | null,
): void {
	sqlite.prepare(`
		INSERT INTO studio_sessions (
			id, title, show_id, show_title, starts_at, recording_prefix, created_by_id,
			stream_environment, stream_status, stream_start_token, stream_heartbeat_at
		) VALUES (?, ?, 'show', 'Show', '2026-01-01T00:00:00Z', ?, 'operator', 'prod', ?, ?, ?)
	`).run(id, id, `studio/recordings/${id}/`, streamStatus, streamToken, heartbeat);
}

function finishStartingSession(
	env: StudioEnv,
	transition: "provisioned" | "live",
	sessionId: string,
	startToken: string,
): Promise<boolean> {
	const common = { playbackUrl: "https://stream.example/play", sessionId, startToken };
	return transition === "provisioned"
		? saveStudioStreamStart(env, { ...common, liveInputId: "input-1" })
		: saveStudioStreamLive(env, { ...common, publicLive: true });
}

afterEach(() => {
	for (const database of databases.splice(0)) database.close();
	vi.unstubAllGlobals();
});

describe("WHIP provider lifecycle", () => {
	it("requires the caller's token before reserving or contacting the provider", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "idle", null, null);
		Object.assign(env, { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_STREAM_API_TOKEN: "secret" });
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		await expect(startStudioStream(env, operator, { sessionId: "session" }))
			.rejects.toMatchObject({ code: "bad-request", status: 400 });
		expect(fetchMock).not.toHaveBeenCalled();
		expect(sqlite.prepare("SELECT count(*) AS count FROM studio_whip_provider_attempts").get()).toMatchObject({ count: 0 });
		expect(sqlite.prepare("SELECT stream_status FROM studio_sessions WHERE id = 'session'").get()).toMatchObject({ stream_status: "idle" });
	});

	it("recovers a lost takeover response when the original claim had no provider reservation", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "starting", "token", now);
		const observation = await getStudioStreamTakeoverObservation(env, "session");
		const expectedTakeoverLease = observation!.takeoverLease!;
		expect(await takeOverStudioStream(env, operator, { sessionId: "session", expectedTakeoverLease }))
			.toMatchObject({ providerRevocation: "not-required" });
		expect(await getStudioTakeoverRecovery(env, operator, { sessionId: "session", expectedTakeoverLease }))
			.toEqual({ sessionId: "session", takeoverState: "revoked" });
		expect(await claimStudioStreamStart(env, "session", "token")).toBe(false);
	});

	it("does not report revoked when a provider reservation races the recovery lookup", async () => {
		let resume!: () => void;
		let entered!: () => void;
		let pause = false;
		const blocked = new Promise<void>((resolve) => { resume = resolve; });
		const started = new Promise<void>((resolve) => { entered = resolve; });
		const { sqlite, env } = createDatabase(false, undefined, {
			onAfterFirst: async (sql) => {
				if (pause && sql.includes("FROM studio_whip_provider_attempts AS p") && sql.includes("takeover_starting_id")) {
					pause = false;
					entered();
					await blocked;
				}
			},
		});
		insertSession(sqlite, "session", "starting", "token", now);
		const session = await getStudioSession(env, "session");
		const expectedTakeoverLease = (await getStudioStreamTakeoverObservation(env, "session"))!.takeoverLease!;
		pause = true;
		const staleLookup = getWhipTakeoverState(env, "session", expectedTakeoverLease);
		await started;
		const attempt = await reserveWhipProviderAttempt(env, { accountId: "account", session: session!, startToken: "token" });
		expect(attempt).not.toBeNull();
		expect(await markWhipCreateDispatched(env, attempt!.attemptId)).toBe(true);
		expect(await takeOverStudioStream(env, operator, { sessionId: "session", expectedTakeoverLease }))
			.toMatchObject({ providerRevocation: "pending" });
		resume();
		expect(await staleLookup).toBe("unknown");
		expect(await getWhipTakeoverState(env, "session", expectedTakeoverLease)).toBe("pending");
	});
	it("associates legacy ownership only with the token present at migration", async () => {
		const { sqlite, env } = createDatabase(false, undefined, { skipWhipMigration: true });
		insertSession(sqlite, "session", "live", "legacy-token", now);
		sqlite.prepare("UPDATE studio_sessions SET cloudflare_stream_live_input_id = 'legacy-input' WHERE id = 'session'").run();
		sqlite.exec(readFileSync(new URL("../../data-model/0011_whip_provider_lifecycle.sql", import.meta.url), "utf8"));
		const observation = await getStudioStreamTakeoverObservation(env, "session");
		const observed = observation!.takeoverLease!;
		expect(await getWhipTakeoverState(env, "session", observed)).toBe("active");
		expect(() => sqlite.exec(`UPDATE studio_whip_provider_readiness SET production_ready = 1,
			provider_account_id = 'account', verified_by = 'test', evidence_reference = 'fixture', verified_at = 1`)).toThrow();
		expect(await takeOverStudioStream(env, operator, { sessionId: "session", expectedTakeoverLease: observed }))
			.toMatchObject({ providerRevocation: "pending" });
		expect(await getWhipTakeoverState(env, "session", observed)).toBe("pending");
		expect(await stopStudioStream(env, operator, { sessionId: "session", streamToken: "legacy-token" }))
			.toMatchObject({ providerRevocation: "pending" });
		expect(await stopStudioStream(env, operator, { sessionId: "session", streamToken: "other-token" }))
			.toMatchObject({ providerRevocation: "not-required" });
		sqlite.prepare("UPDATE studio_whip_legacy_owners SET state = 'retired' WHERE session_id = 'session' AND start_token = 'legacy-token' AND provider_input_id = 'legacy-input'").run();
		expect(() => sqlite.exec(`UPDATE studio_whip_provider_readiness SET production_ready = 1,
			provider_account_id = 'account', verified_by = 'test', evidence_reference = 'fixture', verified_at = 1`)).not.toThrow();
		expect(await getWhipTakeoverState(env, "session", observed)).toBe("revoked");
		expect(await stopStudioStream(env, operator, { sessionId: "session", streamToken: "legacy-token" }))
			.toMatchObject({ providerRevocation: "revoked" });
	});

	it("keeps a legacy active token with an unknown input pending until it is reconciled", async () => {
		const { sqlite, env } = createDatabase(false, undefined, { skipWhipMigration: true });
		insertSession(sqlite, "session", "starting", "legacy-token", now);
		sqlite.exec(readFileSync(new URL("../../data-model/0011_whip_provider_lifecycle.sql", import.meta.url), "utf8"));
		expect(sqlite.prepare("SELECT provider_input_id, state FROM studio_whip_legacy_owners").get())
			.toMatchObject({ provider_input_id: null, state: "pending" });
		const expectedTakeoverLease = (await getStudioStreamTakeoverObservation(env, "session"))!.takeoverLease!;
		expect(await takeOverStudioStream(env, operator, { sessionId: "session", expectedTakeoverLease }))
			.toMatchObject({ providerRevocation: "pending" });
		expect(await getWhipTakeoverState(env, "session", expectedTakeoverLease)).toBe("pending");
		expect(() => sqlite.exec(`UPDATE studio_whip_provider_readiness SET production_ready = 1,
			provider_account_id = 'account', verified_by = 'test', evidence_reference = 'fixture', verified_at = 1`)).toThrow();
		sqlite.prepare("UPDATE studio_whip_legacy_owners SET state = 'retired' WHERE session_id = 'session' AND start_token = 'legacy-token' AND provider_input_id IS NULL").run();
		expect(await getWhipTakeoverState(env, "session", expectedTakeoverLease)).toBe("revoked");
	});

	it("does not attach a retired input to a different token canceled before reservation", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "idle", null, null);
		Object.assign(env, { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_STREAM_API_TOKEN: "secret" });
		vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) =>
			init.method === "DELETE" ? new Response("{}") : providerResponse("input-a")));
		await startStudioStream(env, operator, { sessionId: "session", streamToken: "token-a" });
		expect(await stopStudioStream(env, operator, { sessionId: "session", streamToken: "token-a" }))
			.toMatchObject({ providerRevocation: "revoked" });
		expect(await stopStudioStream(env, operator, { sessionId: "session", streamToken: "token-a" }))
			.toMatchObject({ providerRevocation: "revoked" });
		expect(await claimStudioStreamStart(env, "session", "token-b")).toBe(true);
		expect(await stopStudioStream(env, operator, { sessionId: "session", streamToken: "token-b" }))
			.toMatchObject({ providerRevocation: "not-required", streamStatus: "ended" });
		expect(await stopStudioStream(env, operator, { sessionId: "session", streamToken: "token-b" }))
			.toMatchObject({ providerRevocation: "not-required" });
	});

	it("starts closed for production and binds readiness to the configured account", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "idle", null, null);
		Object.assign(env, { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_STREAM_API_TOKEN: "secret" });
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		sqlite.exec("UPDATE studio_whip_provider_readiness SET production_ready = 0");
		await expect(startStudioStream(env, operator, { sessionId: "session", streamToken: "blocked" }))
			.rejects.toMatchObject({ code: "provider-reconciliation-required", status: 503 });
		expect(fetchMock).not.toHaveBeenCalled();
		expect(() => sqlite.exec("UPDATE studio_whip_provider_readiness SET production_ready = 1, verified_by = NULL"))
			.toThrow();
		sqlite.exec("UPDATE studio_whip_provider_readiness SET production_ready = 1, provider_account_id = 'another-account'");
		await expect(startStudioStream(env, operator, { sessionId: "session", streamToken: "wrong-account" }))
			.rejects.toMatchObject({ code: "provider-reconciliation-required", status: 503 });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("does not return credentials if readiness closes before the final start write", async () => {
		let closeGate = false;
		let sqlite!: DatabaseSync;
		const database = createDatabase(false, async (sql) => {
			if (closeGate && sql.includes("cloudflare_stream_live_input_id = ?")) {
				closeGate = false;
				sqlite.prepare("UPDATE studio_whip_provider_readiness SET production_ready = 0").run();
			}
		});
		sqlite = database.sqlite;
		const { env } = database;
		insertSession(sqlite, "session", "idle", null, null);
		Object.assign(env, { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_STREAM_API_TOKEN: "secret" });
		vi.stubGlobal("fetch", vi.fn(async () => providerResponse("input")));
		closeGate = true;
		await expect(startStudioStream(env, operator, { sessionId: "session", streamToken: "token" }))
			.rejects.toMatchObject({ status: 409 });
		expect(sqlite.prepare("SELECT state, provider_input_id FROM studio_whip_provider_attempts").get())
			.toMatchObject({ state: "revoking", provider_input_id: "input" });
	});

	it("persists the exact create intent before dispatch, blocks a successor, and retires only the old input", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "old", "idle", null, null);
		insertSession(sqlite, "new", "idle", null, null);
		sqlite.prepare("UPDATE studio_sessions SET cloudflare_stream_live_input_id = 'legacy-input' WHERE id = 'old'").run();
		Object.assign(env, { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_STREAM_API_TOKEN: "secret" });
		let creates = 0;
		const deletes: string[] = [];
		vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
			if (init.method === "DELETE") { deletes.push(url); return new Response("{}", { status: deletes.length === 1 ? 500 : 200 }); }
			creates += 1;
			const row = sqlite.prepare("SELECT * FROM studio_whip_provider_attempts WHERE state = 'creating'").get();
			expect(row).toMatchObject({ provider_account_id: "account", create_body: init.body });
			expect(row?.idempotency_key).toBe((init.headers as Record<string, string>)["Idempotency-Key"]);
			expect(String(row?.idempotency_key)).toMatch(/^studio-whip-/);
			return providerResponse(creates === 1 ? "old-input" : "new-input");
		}));
		expect(await startStudioStream(env, operator, { sessionId: "old", streamToken: "old-token" }))
			.toMatchObject({ liveInputId: "old-input" });
		expect(() => sqlite.prepare("UPDATE studio_whip_provider_attempts SET provider_account_id = 'other' WHERE session_id = 'old'").run()).toThrow();
		expect(() => sqlite.prepare("UPDATE studio_whip_provider_attempts SET provider_input_id = 'other' WHERE session_id = 'old'").run()).toThrow();
		expect(() => sqlite.prepare("DELETE FROM studio_whip_provider_attempts WHERE session_id = 'old'").run()).toThrow();
		const observation = await getStudioStreamTakeoverObservation(env, "old");
		const expectedTakeoverLease = observation!.takeoverLease!;
		expect(await getStudioTakeoverRecovery(env, operator, { sessionId: "old", expectedTakeoverLease }))
			.toEqual({ sessionId: "old", takeoverState: "active" });
		await expect(getStudioTakeoverRecovery(env, { ...operator, id: "guest", username: "guest" }, { sessionId: "old", expectedTakeoverLease }))
			.rejects.toMatchObject({ status: 403 });
		expect(await takeOverStudioStream(env, operator, { sessionId: "old", expectedTakeoverLease }))
			.toMatchObject({ streamStatus: "ended", providerRevocation: "pending" });
		expect(await getWhipTakeoverState(env, "old", expectedTakeoverLease)).toBe("pending");
		await expect(startStudioStream(env, operator, { sessionId: "new", streamToken: "blocked-token" }))
			.rejects.toMatchObject({ status: 409 });
		expect(creates).toBe(1);
		expect(await reapWhipProviderAttempts(env)).toEqual({ deleted: 1, pending: 0 });
		expect(deletes).toHaveLength(2);
		expect(deletes[0]).toContain("old-input");
		expect(deletes[1]).toContain("old-input");
		expect(await getWhipTakeoverState(env, "old", expectedTakeoverLease)).toBe("revoked");
		expect(await getWhipTakeoverState(env, "old", "f".repeat(64))).toBe("unknown");
		expect(await startStudioStream(env, operator, { sessionId: "new", streamToken: "new-token" }))
			.toMatchObject({ liveInputId: "new-input" });
		expect(sqlite.prepare("SELECT state, provider_input_id FROM studio_whip_provider_attempts WHERE start_token = 'new-token'").get())
			.toMatchObject({ state: "issued", provider_input_id: "new-input" });
	});

	it.each([404, 403, 500])("keeps the global barrier when deletion returns %s", async (status) => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "old", "idle", null, null);
		insertSession(sqlite, "new", "idle", null, null);
		Object.assign(env, { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_STREAM_API_TOKEN: "secret" });
		vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) =>
			init.method === "DELETE" ? new Response("{}", { status }) : providerResponse("old-input")));
		await startStudioStream(env, operator, { sessionId: "old", streamToken: "old-token" });
		expect(await stopStudioStream(env, operator, { sessionId: "old", streamToken: "old-token" }))
			.toMatchObject({ providerRevocation: "pending" });
		expect(await reapWhipProviderAttempts(env)).toEqual({ deleted: 0, pending: 1 });
		expect(sqlite.prepare("SELECT state FROM studio_whip_provider_attempts").get()).toMatchObject({ state: "revoking" });
		await expect(startStudioStream(env, operator, { sessionId: "new", streamToken: "new-token" }))
			.rejects.toMatchObject({ status: 409 });
	});

	it("accepts an explicit error-free Cloudflare DELETE success envelope", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "idle", null, null);
		Object.assign(env, { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_STREAM_API_TOKEN: "secret" });
		vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) =>
			init.method === "DELETE"
				? new Response(JSON.stringify({ result: "", success: true, errors: [], messages: [] }))
				: providerResponse("input")));
		await startStudioStream(env, operator, { sessionId: "session", streamToken: "token" });
		expect(await stopStudioStream(env, operator, { sessionId: "session", streamToken: "token" }))
			.toMatchObject({ providerRevocation: "revoked" });
	});

	it.each(["timeout", "invalid-json", "provider-error", "unexpected-object", "null-success", "success-with-error", "success-with-extra"] as const)("keeps the global barrier on an ambiguous %s deletion", async (failure) => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "old", "idle", null, null);
		insertSession(sqlite, "new", "idle", null, null);
		Object.assign(env, { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_STREAM_API_TOKEN: "secret" });
		vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
			if (init.method !== "DELETE") return providerResponse("old-input");
			if (failure === "timeout") throw new DOMException("timeout", "TimeoutError");
			if (failure === "invalid-json") return new Response("not json");
			if (failure === "unexpected-object") return new Response('{"error":"still active"}');
			if (failure === "null-success") return new Response('{"success":null}');
			if (failure === "success-with-error") return new Response('{"result":"","success":true,"errors":["error"],"messages":[]}');
			if (failure === "success-with-extra") return new Response('{"result":"","success":true,"errors":[],"messages":[],"other":true}');
			return new Response('{"success":false}');
		}));
		await startStudioStream(env, operator, { sessionId: "old", streamToken: "old-token" });
		await stopStudioStream(env, operator, { sessionId: "old", streamToken: "old-token" });
		expect(await reapWhipProviderAttempts(env)).toEqual({ deleted: 0, pending: 1 });
		await expect(startStudioStream(env, operator, { sessionId: "new", streamToken: "new-token" }))
			.rejects.toMatchObject({ status: 409 });
	});

	it("keeps an unknown create blocked without sending another create", async () => {
		const { sqlite, env } = createDatabase(false, async (sql) => {
			if (sql.includes("SET provider_input_id = ?")) throw new Error("D1 unavailable after create");
		});
		insertSession(sqlite, "old", "idle", null, null);
		insertSession(sqlite, "new", "idle", null, null);
		Object.assign(env, { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_STREAM_API_TOKEN: "secret" });
		const fetchMock = vi.fn(async () => providerResponse("unrecorded-input"));
		vi.stubGlobal("fetch", fetchMock);
		await expect(startStudioStream(env, operator, { sessionId: "old", streamToken: "old-token" })).rejects.toThrow();
		expect(sqlite.prepare("SELECT state, provider_input_id FROM studio_whip_provider_attempts").get())
			.toMatchObject({ state: "uncertain", provider_input_id: null });
		expect(await reapWhipProviderAttempts(env)).toEqual({ deleted: 0, pending: 1 });
		await expect(startStudioStream(env, operator, { sessionId: "new", streamToken: "new-token" }))
			.rejects.toMatchObject({ status: 409 });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("reaps an expired publisher without a client request and retains attempts when a session is deleted", async () => {
		let clock = now;
		const { sqlite, env } = createDatabase(false, undefined, { clock: () => clock });
		insertSession(sqlite, "old", "idle", null, null);
		Object.assign(env, { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_STREAM_API_TOKEN: "secret" });
		let creates = 0;
		vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) =>
			init.method === "DELETE" ? new Response("{}") : providerResponse(`input-${++creates}`)));
		await startStudioStream(env, operator, { sessionId: "old", streamToken: "old-token" });
		clock += 121;
		expect(await reapWhipProviderAttempts(env)).toEqual({ deleted: 1, pending: 0 });
		expect(sqlite.prepare("SELECT stream_status FROM studio_sessions WHERE id = 'old'").get())
			.toMatchObject({ stream_status: "ended" });
		insertSession(sqlite, "deleted", "idle", null, null);
		await startStudioStream(env, operator, { sessionId: "deleted", streamToken: "deleted-token" });
		sqlite.prepare("DELETE FROM studio_sessions WHERE id = 'deleted'").run();
		expect(sqlite.prepare("SELECT state, provider_input_id FROM studio_whip_provider_attempts WHERE session_id = 'deleted'").get())
			.toMatchObject({ state: "issued", provider_input_id: "input-2" });
		expect(await reapWhipProviderAttempts(env)).toEqual({ deleted: 1, pending: 0 });
		expect(sqlite.prepare("SELECT state FROM studio_whip_provider_attempts WHERE session_id = 'deleted'").get())
			.toMatchObject({ state: "retired" });
	});

	it("rechecks the lease atomically if a fresh heartbeat wins after the reaper reads", async () => {
		let clock = now;
		let refresh = false;
		let sqlite!: DatabaseSync;
		const database = createDatabase(false, async (sql) => {
			if (refresh && sql.includes("AND state = ? AND NOT EXISTS")) {
				refresh = false;
				sqlite.prepare("UPDATE studio_sessions SET stream_heartbeat_at = ? WHERE id = 'session'").run(clock);
			}
		}, { clock: () => clock });
		sqlite = database.sqlite;
		const { env } = database;
		insertSession(sqlite, "session", "idle", null, null);
		Object.assign(env, { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_STREAM_API_TOKEN: "secret" });
		const fetchMock = vi.fn(async (_url: string, init: RequestInit) =>
			init.method === "DELETE" ? new Response("{}") : providerResponse("input"));
		vi.stubGlobal("fetch", fetchMock);
		await startStudioStream(env, operator, { sessionId: "session", streamToken: "token" });
		clock += 121;
		refresh = true;
		expect(await reapWhipProviderAttempts(env)).toEqual({ deleted: 0, pending: 0 });
		expect(sqlite.prepare("SELECT state FROM studio_whip_provider_attempts").get()).toMatchObject({ state: "issued" });
		expect(await saveStudioStreamHeartbeat(env, "session", "token")).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("keeps the barrier when delete succeeds but its D1 retirement acknowledgement is lost", async () => {
		let failRetirement = true;
		const { sqlite, env } = createDatabase(false, async (sql) => {
			if (failRetirement && sql.includes("SET state = 'retired', updated_at")) {
				failRetirement = false;
				throw new Error("lost D1 acknowledgement");
			}
		});
		insertSession(sqlite, "old", "idle", null, null);
		insertSession(sqlite, "new", "idle", null, null);
		Object.assign(env, { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_STREAM_API_TOKEN: "secret" });
		let deletes = 0;
		vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
			if (init.method !== "DELETE") return providerResponse("input");
			return new Response("{}", { status: ++deletes === 1 ? 200 : 404 });
		}));
		await startStudioStream(env, operator, { sessionId: "old", streamToken: "token" });
		await stopStudioStream(env, operator, { sessionId: "old", streamToken: "token" });
		expect(await reapWhipProviderAttempts(env)).toEqual({ deleted: 0, pending: 1 });
		expect(await reapWhipProviderAttempts(env)).toEqual({ deleted: 0, pending: 1 });
		expect(sqlite.prepare("SELECT state FROM studio_whip_provider_attempts").get()).toMatchObject({ state: "revoking" });
		await expect(startStudioStream(env, operator, { sessionId: "new", streamToken: "new-token" }))
			.rejects.toMatchObject({ status: 409 });
	});

	it("does not let a delayed stop deletion retire a successor after cron wins", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "old", "idle", null, null);
		insertSession(sqlite, "new", "idle", null, null);
		Object.assign(env, { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_STREAM_API_TOKEN: "secret" });
		let releaseDelete!: (response: Response) => void;
		let deleteStarted!: () => void;
		const deleteEntered = new Promise<void>((resolve) => { deleteStarted = resolve; });
		const delayedDelete = new Promise<Response>((resolve) => { releaseDelete = resolve; });
		let deletes = 0;
		let creates = 0;
		vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
			if (init.method === "DELETE") {
				deletes += 1;
				if (deletes === 1) { deleteStarted(); return delayedDelete; }
				return new Response("{}");
			}
			creates += 1;
			return providerResponse(creates === 1 ? "old-input" : "new-input");
		}));
		await startStudioStream(env, operator, { sessionId: "old", streamToken: "old-token" });
		const delayedStop = stopStudioStream(env, operator, { sessionId: "old", streamToken: "old-token" });
		await deleteEntered;
		expect(await reapWhipProviderAttempts(env)).toEqual({ deleted: 1, pending: 0 });
		await startStudioStream(env, operator, { sessionId: "new", streamToken: "new-token" });
		releaseDelete(new Response("{}"));
		expect(await delayedStop).toMatchObject({ providerRevocation: "revoked" });
		expect(sqlite.prepare("SELECT state, provider_input_id FROM studio_whip_provider_attempts WHERE session_id = 'new'").get())
			.toMatchObject({ state: "issued", provider_input_id: "new-input" });
	});

	it("prioritizes production and bounds each sweep while rotating a test backlog", async () => {
		const { sqlite, env } = createDatabase();
		Object.assign(env, { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_STREAM_API_TOKEN: "secret" });
		const insert = sqlite.prepare(`INSERT INTO studio_whip_provider_attempts (
			attempt_id, session_id, start_token, stream_environment, provider_account_id,
			idempotency_key, create_body, takeover_starting_id, takeover_live_id, state,
			provider_input_id, updated_at
		) VALUES (?, ?, ?, ?, 'account', ?, '{}', ?, ?, 'revoking', ?, ?)`);
		for (let index = 0; index < 6; index += 1) {
			const id = `test-${index}`;
			insert.run(id, id, id, "test", id, id, id, id, 100 + index);
		}
		insert.run("prod", "prod", "prod", "prod", "prod", "prod", "prod", "prod", 1000);
		const deleted: string[] = [];
		vi.stubGlobal("fetch", vi.fn(async (url: string) => {
			deleted.push(url.split("/").at(-1)!);
			return new Response("{}", { status: 500 });
		}));
		expect(await reapWhipProviderAttempts(env)).toEqual({ deleted: 0, pending: 5 });
		expect(deleted).toEqual(["prod", "test-0", "test-1", "test-2", "test-3"]);
		deleted.length = 0;
		expect(await reapWhipProviderAttempts(env)).toEqual({ deleted: 0, pending: 5 });
		expect(deleted.slice(0, 3)).toEqual(["prod", "test-4", "test-5"]);
	});
});

describe("Studio publisher lease SQL", () => {
	it("does not reopen a completed session when a delayed provider confirmation returns", async () => {
		let releaseEnd!: () => void;
		let endCommitted!: () => void;
		const endBlocked = new Promise<void>((resolve) => { releaseEnd = resolve; });
		const endWritten = new Promise<void>((resolve) => { endCommitted = resolve; });
		const { sqlite, env } = createDatabase(false, undefined, {
			onAfterRun: async (sql) => {
				if (sql.includes("SET status = ?")) {
					endCommitted();
					await endBlocked;
				}
			},
		});
		insertSession(sqlite, "session", "starting", "token", now);
		sqlite.prepare("UPDATE studio_sessions SET cloudflare_stream_live_input_id = ? WHERE id = ?")
			.run("input", "session");
		let releaseProvider!: (response: Response) => void;
		let providerCalled!: () => void;
		const providerStarted = new Promise<void>((resolve) => { providerCalled = resolve; });
		const providerResponsePending = new Promise<Response>((resolve) => { releaseProvider = resolve; });
		const queue = { send: vi.fn(async () => undefined) };
		Object.assign(env, {
			CLOUDFLARE_ACCOUNT_ID: "account",
			CLOUDFLARE_STREAM_API_TOKEN: "secret",
			STREAM_NOTIFICATIONS: queue,
		});
		vi.stubGlobal("fetch", vi.fn(() => {
			providerCalled();
			return providerResponsePending;
		}));
		const confirmation = confirmStudioStream(env, operator, { sessionId: "session", streamToken: "token" })
			.catch((error: unknown) => error);
		await providerStarted;
		const ending = endStudioSession(env, operator, { sessionId: "session" });
		await endWritten;
		try {
			releaseProvider(providerResponse("input"));
			expect(await confirmation).toMatchObject({ status: 409 });
			expect(sqlite.prepare("SELECT status, stream_status, stream_start_token FROM studio_sessions WHERE id = ?").get("session"))
				.toMatchObject({ status: "complete", stream_status: "ended", stream_start_token: null });
			expect(queue.send).not.toHaveBeenCalled();
		} finally {
			releaseEnd();
		}
		expect(await ending).toEqual({ sessionId: "session", status: "complete" });
	});

	it.each(["starting", "live"] as const)("rejects publisher updates on a completed legacy %s row", async (streamStatus) => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", streamStatus, "token", now);
		sqlite.prepare("UPDATE studio_sessions SET status = 'complete' WHERE id = ?").run("session");
		expect(await saveStudioStreamHeartbeat(env, "session", "token")).toBe(false);
		if (streamStatus === "starting") {
			expect(await finishStartingSession(env, "provisioned", "session", "token")).toBe(false);
			expect(await finishStartingSession(env, "live", "session", "token")).toBe(false);
		}
		expect(sqlite.prepare("SELECT status, stream_status, stream_start_token FROM studio_sessions WHERE id = ?").get("session"))
			.toMatchObject({ status: "complete", stream_status: streamStatus, stream_start_token: "token" });
	});

	it("keeps the publisher active when a fresh recording prevents session completion", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "starting", "token", now);
		sqlite.prepare(`UPDATE studio_sessions SET recording_status = 'recording',
			recording_lease_id = 'recording', recording_heartbeat_at = ? WHERE id = ?`)
			.run(now, "session");
		await expect(endStudioSession(env, operator, { sessionId: "session" }))
			.rejects.toMatchObject({ code: "recording-active", status: 409 });
		expect(sqlite.prepare("SELECT status, stream_status, stream_start_token FROM studio_sessions WHERE id = ?").get("session"))
			.toMatchObject({ status: "scheduled", stream_status: "starting", stream_start_token: "token" });
	});
	it("preserves a legacy pre-cancel token during the migration", async () => {
		const { sqlite, env } = createDatabase(true);
		insertSession(sqlite, "session", "ended", "legacy-token", null);
		sqlite.exec(readFileSync(new URL("../../data-model/0010_stream_cancelled_attempts.sql", import.meta.url), "utf8"));
		expect(await claimStudioStreamStart(env, "session", "new-token")).toBe(true);
		expect(await cancelStudioStreamAttempt(env, "session", "new-token")).toEqual({ ended: true });
		expect(await claimStudioStreamStart(env, "session", "legacy-token")).toBe(false);
	});

	it("persists cancellation before claim through a different start and stop", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "idle", null, null);
		const cancel = () => stopStudioStream(env, operator, { sessionId: "session", streamToken: "cancelled-token" });
		expect(await cancel()).toEqual({ cancellationRecorded: true, providerRevocation: "not-required", sessionId: "session", streamStatus: "unchanged" });
		expect(await cancel()).toEqual({ cancellationRecorded: true, providerRevocation: "not-required", sessionId: "session", streamStatus: "unchanged" });
		expect(await claimStudioStreamStart(env, "session", "new-token")).toBe(true);
		expect(await cancelStudioStreamAttempt(env, "session", "new-token")).toEqual({ ended: true });
		expect(await claimStudioStreamStart(env, "session", "cancelled-token")).toBe(false);
		expect(sqlite.prepare("SELECT COUNT(*) AS count FROM studio_stream_cancelled_attempts WHERE session_id = ?").get("session"))
			.toMatchObject({ count: 2 });
	});

	it.each(["starting", "live"] as const)("cancels a different token without changing an active %s publisher", async (status) => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", status, "owner-token", now);
		const cancel = () => stopStudioStream(env, operator, { sessionId: "session", streamToken: "other-token" });
		expect(await cancel()).toEqual({ cancellationRecorded: true, providerRevocation: "not-required", sessionId: "session", streamStatus: "unchanged" });
		expect(await cancel()).toEqual({ cancellationRecorded: true, providerRevocation: "not-required", sessionId: "session", streamStatus: "unchanged" });
		expect(sqlite.prepare("SELECT stream_status, stream_start_token, stream_heartbeat_at FROM studio_sessions WHERE id = ?").get("session"))
			.toMatchObject({ stream_status: status, stream_start_token: "owner-token", stream_heartbeat_at: now });
		expect(await saveStudioStreamHeartbeat(env, "session", "owner-token")).toBe(true);
		expect(await cancelStudioStreamAttempt(env, "session", "owner-token")).toEqual({ ended: true });
		expect(await claimStudioStreamStart(env, "session", "other-token")).toBe(false);
	});

	it("rolls back the tombstone when ending the matching publisher fails", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "live", "owner-token", now);
		sqlite.exec(`CREATE TRIGGER reject_end BEFORE UPDATE ON studio_sessions
			WHEN NEW.stream_status = 'ended' BEGIN SELECT RAISE(ABORT, 'simulated end failure'); END;`);
		await expect(cancelStudioStreamAttempt(env, "session", "owner-token")).rejects.toThrow("simulated end failure");
		expect(sqlite.prepare("SELECT COUNT(*) AS count FROM studio_stream_cancelled_attempts").get()).toMatchObject({ count: 0 });
		expect(sqlite.prepare("SELECT stream_status, stream_start_token FROM studio_sessions WHERE id = ?").get("session"))
			.toMatchObject({ stream_status: "live", stream_start_token: "owner-token" });
	});

	it("fences late provider transitions after cancellation and keeps the replacement publisher", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "starting", "old-token", now);
		expect(await cancelStudioStreamAttempt(env, "session", "old-token")).toEqual({ ended: true });
		expect(await claimStudioStreamStart(env, "session", "new-token")).toBe(true);
		expect(await finishStartingSession(env, "provisioned", "session", "old-token")).toBe(false);
		expect(await finishStartingSession(env, "live", "session", "old-token")).toBe(false);
		expect(await cancelStudioStreamAttempt(env, "session", "old-token")).toEqual({ ended: false });
		expect(sqlite.prepare("SELECT stream_status, stream_start_token FROM studio_sessions WHERE id = ?").get("session"))
			.toMatchObject({ stream_status: "starting", stream_start_token: "new-token" });
	});

	it.each(["starting", "live"] as const)("fences a duplicate %s start after takeover and a replacement ends", async (status) => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", status, "old-token", now);
		expect(await takeOverStudioStreamLease(env, "session", { status, startToken: "old-token" })).toBe(true);
		expect(await claimStudioStreamStart(env, "session", "new-token")).toBe(true);
		expect(await cancelStudioStreamAttempt(env, "session", "new-token")).toEqual({ ended: true });
		expect(await claimStudioStreamStart(env, "session", "old-token")).toBe(false);
		expect(sqlite.prepare("SELECT start_token FROM studio_stream_cancelled_attempts WHERE session_id = ? ORDER BY start_token").all("session"))
			.toEqual([{ start_token: "new-token" }, { start_token: "old-token" }]);
	});

	it("does not tombstone or end a replacement owner when the observed lease changed", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "live", "old-token", now);
		const observed = { status: "live" as const, startToken: "old-token" };
		sqlite.prepare("UPDATE studio_sessions SET stream_start_token = ? WHERE id = ?").run("new-token", "session");
		expect(await takeOverStudioStreamLease(env, "session", observed)).toBe(false);
		expect(sqlite.prepare("SELECT stream_status, stream_start_token FROM studio_sessions WHERE id = ?").get("session"))
			.toMatchObject({ stream_status: "live", stream_start_token: "new-token" });
		expect(sqlite.prepare("SELECT COUNT(*) AS count FROM studio_stream_cancelled_attempts").get()).toMatchObject({ count: 0 });
		expect(await saveStudioStreamHeartbeat(env, "session", "new-token")).toBe(true);
		expect(await cancelStudioStreamAttempt(env, "session", "new-token")).toEqual({ ended: true });
		expect(await claimStudioStreamStart(env, "session", "old-token")).toBe(true);
	});

	it("does not tombstone the observed token if the active lease status changed", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "live", "token", now);
		expect(await takeOverStudioStreamLease(env, "session", { status: "starting", startToken: "token" })).toBe(false);
		expect(sqlite.prepare("SELECT COUNT(*) AS count FROM studio_stream_cancelled_attempts").get()).toMatchObject({ count: 0 });
		expect(await saveStudioStreamHeartbeat(env, "session", "token")).toBe(true);
	});

	it("takes over a legacy active lease without a token", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "live", null, now);
		expect(await takeOverStudioStreamLease(env, "session", { status: "live", startToken: null })).toBe(true);
		expect(await claimStudioStreamStart(env, "session", "new-token")).toBe(true);
	});

	it("rolls back the takeover tombstone when ending the lease fails", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "live", "token", now);
		sqlite.exec(`CREATE TRIGGER reject_end BEFORE UPDATE ON studio_sessions
			WHEN NEW.stream_status = 'ended' BEGIN SELECT RAISE(ABORT, 'simulated end failure'); END;`);
		await expect(takeOverStudioStreamLease(env, "session", { status: "live", startToken: "token" }))
			.rejects.toThrow("simulated end failure");
		expect(sqlite.prepare("SELECT COUNT(*) AS count FROM studio_stream_cancelled_attempts").get()).toMatchObject({ count: 0 });
		expect(await saveStudioStreamHeartbeat(env, "session", "token")).toBe(true);
	});

	it("rejects a delayed takeover for an observed publisher after a replacement starts", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "live", "old-token", now);
		const observed = await getStudioStreamTakeoverObservation(env, "session");
		expect(observed).toMatchObject({ streamStatus: "live", takeoverLease: expect.any(String) });
		expect(observed?.takeoverLease).not.toContain("old-token");
		expect(await takeOverStudioStreamLease(env, "session", { status: "live", startToken: "old-token" })).toBe(true);
		expect(await claimStudioStreamStart(env, "session", "new-token")).toBe(true);
		await expect(takeOverStudioStream(env, operator, {
			sessionId: "session", expectedTakeoverLease: observed?.takeoverLease ?? undefined,
		})).rejects.toMatchObject({ code: "takeover-precondition-failed", status: 409 });
		expect(sqlite.prepare("SELECT stream_status, stream_start_token FROM studio_sessions WHERE id = ?").get("session"))
			.toMatchObject({ stream_status: "starting", stream_start_token: "new-token" });
		expect(sqlite.prepare("SELECT COUNT(*) AS count FROM studio_stream_cancelled_attempts WHERE session_id = ? AND start_token = ?")
			.get("session", "new-token")).toMatchObject({ count: 0 });
		const current = await getStudioStreamTakeoverObservation(env, "session");
		expect(await takeOverStudioStream(env, operator, {
			sessionId: "session", expectedTakeoverLease: current?.takeoverLease ?? undefined,
		})).toEqual({ providerRevocation: "not-required", sessionId: "session", streamStatus: "ended" });
	});

	it("rejects a takeover if the publisher changes after its server read", async () => {
		let sqlite!: DatabaseSync;
		let replaceBeforeBatch = false;
		const database = createDatabase(false, undefined, {
			onBeforeBatch: async (sql) => {
				if (replaceBeforeBatch && sql[0]?.includes("SELECT id, stream_start_token")) {
					replaceBeforeBatch = false;
					sqlite.prepare("UPDATE studio_sessions SET stream_start_token = ? WHERE id = ?")
						.run("new-token", "session");
				}
			},
		});
		sqlite = database.sqlite;
		const { env } = database;
		insertSession(sqlite, "session", "live", "old-token", now);
		const observed = await getStudioStreamTakeoverObservation(env, "session");
		replaceBeforeBatch = true;
		await expect(takeOverStudioStream(env, operator, {
			sessionId: "session", expectedTakeoverLease: observed?.takeoverLease ?? undefined,
		})).rejects.toMatchObject({ code: "takeover-precondition-failed", status: 409 });
		expect(sqlite.prepare("SELECT stream_status, stream_start_token FROM studio_sessions WHERE id = ?").get("session"))
			.toMatchObject({ stream_status: "live", stream_start_token: "new-token" });
		expect(sqlite.prepare("SELECT COUNT(*) AS count FROM studio_stream_cancelled_attempts").get()).toMatchObject({ count: 0 });
	});

	it("fails closed on missing observations, inactive leases, status changes, and legacy null tokens", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "starting", "token", now);
		const observed = await getStudioStreamTakeoverObservation(env, "session");
		await expect(takeOverStudioStream(env, operator, { sessionId: "session" }))
			.rejects.toMatchObject({ code: "bad-request", status: 400 });
		sqlite.prepare("UPDATE studio_sessions SET stream_status = 'live' WHERE id = ?").run("session");
		await expect(takeOverStudioStream(env, operator, {
			sessionId: "session", expectedTakeoverLease: observed?.takeoverLease ?? undefined,
		})).rejects.toMatchObject({ code: "takeover-precondition-failed", status: 409 });
		sqlite.prepare("UPDATE studio_sessions SET stream_start_token = NULL WHERE id = ?").run("session");
		expect(await getStudioStreamTakeoverObservation(env, "session"))
			.toEqual({ streamStatus: "live", takeoverLease: null });
		await expect(takeOverStudioStream(env, operator, {
			sessionId: "session", expectedTakeoverLease: observed?.takeoverLease ?? undefined,
		})).rejects.toMatchObject({ code: "takeover-precondition-failed", status: 409 });
		sqlite.prepare("UPDATE studio_sessions SET stream_status = 'ended' WHERE id = ?").run("session");
		expect(await getStudioStreamTakeoverObservation(env, "session"))
			.toEqual({ streamStatus: "ended", takeoverLease: null });
		await expect(takeOverStudioStream(env, operator, {
			sessionId: "session", expectedTakeoverLease: observed?.takeoverLease ?? undefined,
		})).rejects.toMatchObject({ code: "takeover-precondition-failed", status: 409 });
	});

	it("fences an expired start token before a delayed duplicate and provider completion", async () => {
		let clock = now;
		const { sqlite, env } = createDatabase(false, undefined, { clock: () => clock });
		insertSession(sqlite, "session", "idle", null, null);
		Object.assign(env, { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_STREAM_API_TOKEN: "secret" });
		let resolveProvider!: (response: Response) => void;
		let providerCalled!: () => void;
		const providerStarted = new Promise<void>((resolve) => { providerCalled = resolve; });
		const delayedProvider = new Promise<Response>((resolve) => { resolveProvider = resolve; });
		const fetchMock = vi.fn((_url: string, init: RequestInit) => {
			if (init.method === "DELETE") return Promise.resolve(new Response("{}"));
			if (fetchMock.mock.calls.length === 1) {
				providerCalled();
				return delayedProvider;
			}
			return Promise.resolve(providerResponse("new-input"));
		});
		vi.stubGlobal("fetch", fetchMock);
		const original = startStudioStream(env, operator, { sessionId: "session", streamToken: "old-token" })
			.catch((error: unknown) => error);
		await providerStarted;
		clock += 121;
		expect(await expireStaleStudioStreams(env, "session")).toBe(1);
		await expect(startStudioStream(env, operator, { sessionId: "session", streamToken: "old-token" }))
			.rejects.toMatchObject({ status: 409 });
		await expect(startStudioStream(env, operator, { sessionId: "session", streamToken: "new-token" }))
			.rejects.toMatchObject({ status: 409 });
		resolveProvider(providerResponse("old-input"));
		expect(await original).toMatchObject({ status: 409 });
		expect(await reapWhipProviderAttempts(env)).toEqual({ deleted: 1, pending: 0 });
		expect(await startStudioStream(env, operator, { sessionId: "session", streamToken: "replacement-token" }))
			.toMatchObject({ liveInputId: "new-input", streamStatus: "starting" });
		expect(sqlite.prepare("SELECT stream_status, stream_start_token, cloudflare_stream_live_input_id FROM studio_sessions WHERE id = ?").get("session"))
			.toMatchObject({ stream_status: "starting", stream_start_token: "replacement-token", cloudflare_stream_live_input_id: "new-input" });
	});

	it("expires only the requested session and handles legacy null tokens during global expiry", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "a", "starting", "token-a", now - 121);
		insertSession(sqlite, "b", "live", "token-b", now - 21);
		insertSession(sqlite, "legacy", "live", null, null);
		expect(await expireStaleStudioStreams(env, "a")).toBe(1);
		expect(sqlite.prepare("SELECT stream_status, stream_start_token FROM studio_sessions WHERE id = ?").get("b"))
			.toMatchObject({ stream_status: "live", stream_start_token: "token-b" });
		expect(sqlite.prepare("SELECT session_id, start_token FROM studio_stream_cancelled_attempts").all())
			.toEqual([{ session_id: "a", start_token: "token-a" }]);
		expect(await expireStaleStudioStreams(env)).toBe(2);
		expect(sqlite.prepare("SELECT stream_status, stream_start_token FROM studio_sessions WHERE id = ?").get("legacy"))
			.toMatchObject({ stream_status: "ended", stream_start_token: null });
		expect(sqlite.prepare("SELECT session_id FROM studio_stream_cancelled_attempts ORDER BY session_id").all())
			.toEqual([{ session_id: "a" }, { session_id: "b" }]);
	});

	it("does not end an unfenced token when the clock advances during expiry", async () => {
		let clock = now;
		const { sqlite, env } = createDatabase(false, undefined, {
			clock: () => clock,
			onBatchStep: (index) => { if (index === 0) clock += 1; },
		});
		insertSession(sqlite, "stale", "starting", "old-token", now - 121);
		insertSession(sqlite, "boundary", "starting", "boundary-token", now - 120);
		expect(await expireStaleStudioStreams(env)).toBe(1);
		expect(sqlite.prepare("SELECT stream_status, stream_start_token FROM studio_sessions WHERE id = ?").get("boundary"))
			.toMatchObject({ stream_status: "starting", stream_start_token: "boundary-token" });
		expect(sqlite.prepare("SELECT start_token FROM studio_stream_cancelled_attempts WHERE session_id = ?").get("boundary"))
			.toBeUndefined();
		expect(await expireStaleStudioStreams(env)).toBe(1);
		expect(await claimStudioStreamStart(env, "boundary", "boundary-token")).toBe(false);
	});

	it("rolls back expiry tombstones if ending a stale lease fails", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "live", "old-token", now - 21);
		sqlite.exec(`CREATE TRIGGER reject_expiry BEFORE UPDATE ON studio_sessions
			WHEN NEW.stream_status = 'ended' BEGIN SELECT RAISE(ABORT, 'simulated expiry failure'); END;`);
		await expect(expireStaleStudioStreams(env, "session")).rejects.toThrow("simulated expiry failure");
		expect(sqlite.prepare("SELECT COUNT(*) AS count FROM studio_stream_cancelled_attempts").get()).toMatchObject({ count: 0 });
		expect(sqlite.prepare("SELECT stream_status, stream_start_token FROM studio_sessions WHERE id = ?").get("session"))
			.toMatchObject({ stream_status: "live", stream_start_token: "old-token" });
	});

	it("scopes tombstones to a session and deletes them with the session", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "a", "idle", null, null);
		insertSession(sqlite, "b", "idle", null, null);
		await cancelStudioStreamAttempt(env, "a", "token");
		expect(await claimStudioStreamStart(env, "b", "token")).toBe(true);
		sqlite.prepare("DELETE FROM studio_sessions WHERE id = ?").run("a");
		expect(sqlite.prepare("SELECT COUNT(*) AS count FROM studio_stream_cancelled_attempts").get()).toMatchObject({ count: 0 });
	});

	it.each([
		["fresh boundary", now - 20, "owner-token", true],
		["expired", now - 21, "owner-token", false],
		["missing heartbeat", null, "owner-token", false],
		["different owner", now, "other-token", false],
	] as const)("only claims a notification for the current fresh lease: %s", async (_name, heartbeat, token, expected) => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "live", "owner-token", heartbeat);
		sqlite.prepare("UPDATE studio_sessions SET status = 'live' WHERE id = ?").run("session");
		expect(await claimStudioStreamNotification(env, "session", now, token)).toBe(expected);
	});

	it("omits expired and missing live leases from the public show lineup", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "stale", "live", "stale-token", now - 21);
		insertSession(sqlite, "fresh", "live", "fresh-token", now - 20);
		sqlite.exec(`UPDATE studio_sessions SET status = 'live',
			cloudflare_stream_playback_url = 'https://stream.example/play',
			stream_started_at = CASE id WHEN 'stale' THEN 200 ELSE 100 END`);
		expect((await getPublicStudioShowLineup(env)).live?.id).toBe("fresh");
		sqlite.prepare("UPDATE studio_sessions SET stream_heartbeat_at = NULL WHERE id = ?").run("fresh");
		expect((await getPublicStudioShowLineup(env)).live).toBeNull();
	});

	it("does not let a cancelled provider response overwrite or end a newer publisher", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "idle", null, null);
		Object.assign(env, { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_STREAM_API_TOKEN: "secret" });
		let resolveProvider!: (response: Response) => void;
		let providerCalled!: () => void;
		const providerStarted = new Promise<void>((resolve) => { providerCalled = resolve; });
		const delayedProvider = new Promise<Response>((resolve) => { resolveProvider = resolve; });
		const fetchMock = vi.fn((_url: string, init: RequestInit) => {
			if (init.method === "DELETE") return Promise.resolve(new Response("{}"));
			if (fetchMock.mock.calls.length === 1) {
				providerCalled();
				return delayedProvider;
			}
			return Promise.resolve(providerResponse("new-input"));
		});
		vi.stubGlobal("fetch", fetchMock);

		const staleStart = startStudioStream(env, operator, { sessionId: "session", streamToken: "old-token" })
			.catch((error: unknown) => error);
		await providerStarted;
		expect(await stopStudioStream(env, operator, { sessionId: "session", streamToken: "old-token" }))
			.toMatchObject({ cancellationRecorded: true, streamStatus: "ended" });
		await expect(startStudioStream(env, operator, { sessionId: "session", streamToken: "new-token" }))
			.rejects.toMatchObject({ status: 409 });
		resolveProvider(providerResponse("old-input"));
		expect(await staleStart).toMatchObject({ status: 409 });
		expect(await reapWhipProviderAttempts(env)).toEqual({ deleted: 1, pending: 0 });
		expect(await startStudioStream(env, operator, { sessionId: "session", streamToken: "replacement-token" }))
			.toMatchObject({ liveInputId: "new-input", streamStatus: "starting" });
		expect(sqlite.prepare("SELECT stream_status, stream_start_token, cloudflare_stream_live_input_id FROM studio_sessions WHERE id = ?").get("session"))
			.toMatchObject({ stream_status: "starting", stream_start_token: "replacement-token", cloudflare_stream_live_input_id: "new-input" });
	});

	it("does not queue a delayed confirmation for a replacement live publisher", async () => {
		let resumeClaim!: () => void;
		let claimEntered!: () => void;
		const claimBlocked = new Promise<void>((resolve) => { resumeClaim = resolve; });
		const claimStarted = new Promise<void>((resolve) => { claimEntered = resolve; });
		const { sqlite, env } = createDatabase(false, async (sql) => {
			if (sql.includes("SET stream_notification_queued_at = ?")) {
				claimEntered();
				await claimBlocked;
			}
		});
		insertSession(sqlite, "session", "starting", "old-token", now);
		sqlite.prepare("UPDATE studio_sessions SET cloudflare_stream_live_input_id = ? WHERE id = ?")
			.run("old-input", "session");
		const queue = { send: vi.fn(async () => undefined) };
		Object.assign(env, {
			CLOUDFLARE_ACCOUNT_ID: "account",
			CLOUDFLARE_STREAM_API_TOKEN: "secret",
			STREAM_NOTIFICATIONS: queue,
		});
		vi.stubGlobal("fetch", vi.fn(async () => providerResponse("old-input")));
		const oldConfirm = confirmStudioStream(env, operator, { sessionId: "session", streamToken: "old-token" });
		await claimStarted;
		try {
			await stopStudioStream(env, operator, { sessionId: "session", streamToken: "old-token" });
			expect(await claimStudioStreamStart(env, "session", "new-token")).toBe(true);
			expect(await finishStartingSession(env, "live", "session", "new-token")).toBe(true);
		} finally {
			resumeClaim();
		}
		expect(await oldConfirm).toMatchObject({ notified: false });
		expect(queue.send).not.toHaveBeenCalled();
		expect(sqlite.prepare("SELECT stream_notification_queued_at FROM studio_sessions WHERE id = ?").get("session"))
			.toMatchObject({ stream_notification_queued_at: null });
	});
	it.each([
		["starting", 120],
		["live", 20],
	] as const)("does not revive an expired %s publisher after another session starts", async (status, timeout) => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "old", status, "old-token", now - timeout - 1);
		insertSession(sqlite, "new", "idle", null, null);

		expect(await claimStudioStreamStart(env, "new", "new-token")).toBe(true);
		expect(await saveStudioStreamHeartbeat(env, "old", "old-token")).toBe(false);
		expect(sqlite.prepare("SELECT stream_heartbeat_at FROM studio_sessions WHERE id = ?").get("old"))
			.toMatchObject({ stream_heartbeat_at: now - timeout - 1 });
	});

	it.each(["provisioned", "live"] as const)("rejects a delayed %s transition after another session starts", async (transition) => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "old", "starting", "old-token", now - 121);
		insertSession(sqlite, "new", "idle", null, null);

		expect(await claimStudioStreamStart(env, "new", "new-token")).toBe(true);
		expect(await finishStartingSession(env, transition, "old", "old-token")).toBe(false);
		expect(sqlite.prepare("SELECT stream_status, stream_heartbeat_at FROM studio_sessions WHERE id = ?").get("old"))
			.toMatchObject({ stream_status: "starting", stream_heartbeat_at: now - 121 });
	});

	it.each(["provisioned", "live"] as const)("allows a fresh %s transition at the starting-lease boundary", async (transition) => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "starting", "token", now - 120);

		expect(await finishStartingSession(env, transition, "session", "token")).toBe(true);
	});

	it.each([
		["starting", 120],
		["live", 20],
	] as const)("renews a %s publisher at the freshness boundary and blocks a second session", async (status, timeout) => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "old", status, "old-token", now - timeout);
		insertSession(sqlite, "new", "idle", null, null);

		expect(await saveStudioStreamHeartbeat(env, "old", "old-token")).toBe(true);
		expect(await claimStudioStreamStart(env, "new", "new-token")).toBe(false);
	});

	it("rejects a missing heartbeat and permits explicit same-session takeover", async () => {
		const { sqlite, env } = createDatabase();
		insertSession(sqlite, "session", "live", "old-token", null);
		expect(await saveStudioStreamHeartbeat(env, "session", "old-token")).toBe(false);

		expect(await takeOverStudioStreamLease(env, "session", {
			status: "live",
			startToken: "old-token",
		})).toBe(true);
		expect(await claimStudioStreamStart(env, "session", "new-token")).toBe(true);
		expect(await saveStudioStreamHeartbeat(env, "session", "old-token")).toBe(false);
		expect(await saveStudioStreamHeartbeat(env, "session", "new-token")).toBe(true);
		expect(await finishStartingSession(env, "provisioned", "session", "old-token")).toBe(false);
		expect(await finishStartingSession(env, "provisioned", "session", "new-token")).toBe(true);
		expect(await finishStartingSession(env, "live", "session", "old-token")).toBe(false);
		expect(await finishStartingSession(env, "live", "session", "new-token")).toBe(true);
	});
});
