import type { Env } from "../env";
import { PROTOCOL_VERSION, type Principal } from "../domain/protocol";
import { boundedAudienceBin, normalizeAudienceChoice } from "../domain/audience-choice";

type SubmissionIntent = { command_id: string; room_id: string; prompt_id: string; shard_id: string; principal_id: string; choice: string };

/** Coalesces high-volume audience input before a single update is sent to the room actor. */
export class AudienceShard implements DurableObject {
	constructor(private readonly state: DurableObjectState, private readonly env: Env) {
		this.state.blockConcurrencyWhile(async () => {
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS audience_votes (round_id TEXT NOT NULL, choice TEXT NOT NULL, total INTEGER NOT NULL, PRIMARY KEY (round_id, choice))");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS audience_ballots (round_id TEXT NOT NULL, principal_id TEXT NOT NULL, PRIMARY KEY (round_id, principal_id))");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS used_tickets (nonce TEXT PRIMARY KEY, used_at TEXT NOT NULL)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS audience_commands (round_id TEXT NOT NULL, command_id TEXT NOT NULL, PRIMARY KEY (round_id, command_id))");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS audience_reactions (round_id TEXT NOT NULL, reaction TEXT NOT NULL, total INTEGER NOT NULL, PRIMARY KEY (round_id, reaction))");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS audience_reaction_commands (command_id TEXT PRIMARY KEY)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS pending_command_acks (sequence INTEGER PRIMARY KEY AUTOINCREMENT, mode TEXT NOT NULL, prompt_id TEXT NOT NULL, command_id TEXT NOT NULL, UNIQUE(mode, prompt_id, command_id))");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS submission_intents (command_id TEXT PRIMARY KEY, room_id TEXT NOT NULL, prompt_id TEXT NOT NULL, shard_id TEXT NOT NULL, principal_id TEXT NOT NULL, choice TEXT NOT NULL, status TEXT NOT NULL, admission_version INTEGER)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS pending_flushes (mode TEXT NOT NULL, prompt_id TEXT NOT NULL, room_id TEXT NOT NULL, shard_id TEXT NOT NULL, admission_version INTEGER, attempts INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (mode, prompt_id))");
			try { this.state.storage.sql.exec("ALTER TABLE pending_flushes ADD COLUMN admission_version INTEGER"); } catch { /* Existing shard schema already has the column. */ }
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS test_controls (key TEXT PRIMARY KEY, value INTEGER NOT NULL)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS test_event_log (sequence INTEGER PRIMARY KEY AUTOINCREMENT, event_json TEXT NOT NULL)");
		});
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === "/_internal/connect") return this.upgrade(request);
		if (url.pathname === "/_internal/public-update" && request.method === "POST") return this.publicUpdate(request);
		if (url.pathname === "/_internal/testing/fail-next-flush" && request.method === "POST") return this.setTestFailure(request);
		if (url.pathname === "/_internal/testing/fail-next-admission-response" && request.method === "POST") return this.setTestFailure(request, "admission-response");
		if (url.pathname === "/_internal/testing/interrupt-next-local-vote" && request.method === "POST") return this.setTestFailure(request, "local-vote");
		if (url.pathname === "/_internal/testing/fail-next-public-update" && request.method === "POST") return this.setTestFailure(request, "public-update");
		if (url.pathname === "/_internal/testing/events" && request.method === "GET") return this.testEvents(request);
		if (url.pathname === "/_internal/testing/pending" && request.method === "GET") return this.testPending(request);
		if (url.pathname === "/_internal/submit-reaction" && request.method === "POST") {
			const principal = this.principal(request);
			if (!principal || principal.role !== "audience") return new Response("Forbidden", { status: 403 });
			return this.submitReaction(principal, await request.json<{ roomId: string; reaction: string; promptId: string; shardId: string; commandId: string }>());
		}
		if (url.pathname !== "/_internal/submit" || request.method !== "POST") return new Response("Not found", { status: 404 });
		const principal = this.principal(request);
		if (!principal || principal.role !== "audience") return new Response("Forbidden", { status: 403 });
		return this.submit(principal, await request.json<{ roomId: string; choice: string; promptId: string; shardId: string; commandId?: string }>());
	}

	private async upgrade(request: Request): Promise<Response> {
		if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected websocket", { status: 426 });
		const principal = this.principal(request);
		const roomId = request.headers.get("x-arcade-room-id");
		const shardId = request.headers.get("x-arcade-shard-id");
		const nonce = request.headers.get("x-arcade-ticket-nonce");
		if (!principal || principal.role !== "audience" || !roomId || !shardId || !nonce) return new Response("Unauthorized", { status: 401 });
		const claimed = Array.from(this.state.storage.sql.exec<{ nonce: string }>("INSERT OR IGNORE INTO used_tickets (nonce, used_at) VALUES (?, ?) RETURNING nonce", nonce, new Date().toISOString()));
		if (claimed.length !== 1) return new Response("Ticket has already been used", { status: 401 });
		const pair = new WebSocketPair();
		const client = pair[0];
		const server = pair[1];
		this.state.acceptWebSocket(server, ["audience", `shard:${shardId}`]);
		server.serializeAttachment({ principal, roomId, shardId });
		server.send(JSON.stringify({ v: PROTOCOL_VERSION, type: "event", version: 0, event: "audience.connected", payload: { shardId, roomId } }));
		const game = this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName(roomId));
		const snapshot = await game.fetch("https://game-room.internal/_internal/audience-register", { method: "POST", headers: { "content-type": "application/json", "x-arcade-principal": JSON.stringify({ id: "audience-shard", role: "producer" }) }, body: JSON.stringify({ shardId }) });
		if (snapshot.ok) server.send(await snapshot.text());
		await this.recordPresence(roomId, shardId, principal, 1);
		await this.publishAudiencePresence(roomId, shardId, principal.id, true);
		const offered = request.headers.get("Sec-WebSocket-Protocol")?.split(",").map((value) => value.trim()).find((value) => value.startsWith("arcade-ticket."));
		return new Response(null, { status: 101, webSocket: client, headers: offered ? { "Sec-WebSocket-Protocol": offered } : undefined });
	}

	private async publicUpdate(request: Request): Promise<Response> {
		const principal = this.principal(request);
		if (!principal || principal.role !== "producer") return new Response("Forbidden", { status: 403 });
		const forcedFailure = Array.from(this.state.storage.sql.exec<{ value: number }>("SELECT value FROM test_controls WHERE key = 'public-update'"))[0]?.value ?? 0;
		if (forcedFailure > 0) {
			this.state.storage.sql.exec("UPDATE test_controls SET value = value - 1 WHERE key = 'public-update'");
			return new Response("Test requested audience fanout failure", { status: 503 });
		}
		const payload = await request.text();
		let deliverySequence: number | undefined;
		try { deliverySequence = (JSON.parse(payload) as { deliverySequence?: unknown }).deliverySequence as number | undefined; } catch { return new Response("Invalid public update", { status: 400 }); }
		const previous = Array.from(this.state.storage.sql.exec<{ value: string }>("SELECT value FROM config WHERE key = 'deliverySequence'"))[0]?.value;
		if (typeof deliverySequence === "number" && Number.isSafeInteger(deliverySequence) && Number(previous ?? "-1") >= deliverySequence) return Response.json({ ok: true, ignored: true });
		if (typeof deliverySequence === "number" && Number.isSafeInteger(deliverySequence)) this.state.storage.sql.exec("INSERT OR REPLACE INTO config (key, value) VALUES ('deliverySequence', ?)", String(deliverySequence));
		for (const socket of this.state.getWebSockets()) socket.send(payload);
		return Response.json({ ok: true });
	}

	async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
		const attachment = socket.deserializeAttachment() as { principal: Principal; roomId: string; shardId: string; rate?: { startedAt: number; frames: number } } | null;
		if (!attachment) return socket.close(1008, "Session missing");
		const bytes = typeof message === "string" ? new TextEncoder().encode(message).byteLength : message.byteLength;
		if (bytes > 8_192) return socket.send(JSON.stringify({ v: PROTOCOL_VERSION, type: "error", code: "BAD_COMMAND", message: "Message exceeds 8 KiB" }));
		if (!this.allowFrame(socket, attachment)) return socket.send(JSON.stringify({ v: PROTOCOL_VERSION, type: "error", code: "RATE_LIMITED", message: "Too many messages" }));
		let input: { v?: number; id?: string; type?: string; payload?: { choice?: string; reaction?: string; promptId?: string } };
		try { input = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message)); } catch { return socket.send(JSON.stringify({ v: PROTOCOL_VERSION, type: "error", code: "BAD_COMMAND", message: "Invalid JSON" })); }
		if (input.v !== PROTOCOL_VERSION || !input.id || (input.type !== "audience.vote" && input.type !== "audience.reaction")) return socket.send(JSON.stringify({ v: PROTOCOL_VERSION, type: "error", code: "BAD_COMMAND", message: "Invalid audience command", commandId: input.id }));
		const result = input.type === "audience.reaction"
			? await this.submitReaction(attachment.principal, { roomId: attachment.roomId, shardId: attachment.shardId, promptId: input.payload?.promptId ?? "live", reaction: input.payload?.reaction ?? "like", commandId: input.id })
			: input.payload?.choice ? await this.submit(attachment.principal, { roomId: attachment.roomId, shardId: attachment.shardId, promptId: input.payload.promptId ?? "default", choice: input.payload.choice, commandId: input.id }) : new Response("Invalid vote", { status: 400 });
		const rawPayload = await result.text();
		let payload: unknown;
		try { payload = JSON.parse(rawPayload); } catch { payload = { error: { message: rawPayload || "Vote rejected" } }; }
		if (!result.ok) {
			const error = payload && typeof payload === "object" ? payload as { error?: { code?: string; message?: string } } : undefined;
			return socket.send(JSON.stringify({ v: PROTOCOL_VERSION, type: "error", code: error?.error?.code === "DISTRIBUTION_FROZEN" ? "CONFLICT" : "BAD_COMMAND", message: error?.error?.message ?? "Vote rejected", commandId: input.id }));
		}
		socket.send(JSON.stringify({ v: PROTOCOL_VERSION, type: "event", version: 0, event: "audience.accepted", payload, commandId: input.id }));
	}

	async webSocketClose(socket: WebSocket): Promise<void> {
		const attachment = socket.deserializeAttachment() as { principal: Principal; roomId: string; shardId: string } | null;
		if (attachment) {
			await this.recordPresence(attachment.roomId, attachment.shardId, attachment.principal, -1);
			await this.publishAudiencePresence(attachment.roomId, attachment.shardId, attachment.principal.id, false);
		}
	}

	private async submit(principal: Principal, body: { roomId: string; choice: string; promptId: string; shardId: string; commandId?: string }): Promise<Response> {
		if (!body.roomId || !body.promptId || !body.choice || body.choice.length > 100) return new Response("Invalid vote", { status: 400 });
		if (!body.commandId || typeof body.commandId !== "string" || body.commandId.trim().length === 0) return new Response("Command id required", { status: 400 });
		// Persist the wake-up before any local claim. A restart can therefore leave
		// either no work or recoverable work, never a stranded durable intent.
		await this.scheduleFlush(100);
		const choice = normalizeAudienceChoice(body.choice);
		if (!choice) return new Response("Invalid vote", { status: 400 });
		// Claim the command first, then the one-ballot identity slot, before the
		// coordinator can create an admission. This ordering handles both a fresh
		// command from an already-voted identity and two identities racing the same
		// command ID without leaving a remote drain barrier behind.
		let claimedCommand = false;
		if (body.commandId) {
			claimedCommand = Array.from(this.state.storage.sql.exec<{ command_id: string }>("INSERT OR IGNORE INTO audience_commands (round_id, command_id) VALUES (?, ?) RETURNING command_id", body.promptId, body.commandId)).length === 1;
			if (!claimedCommand) return Response.json({ accepted: true, duplicate: true, shardId: body.shardId }, { status: 202 });
		}
		const ballot = Array.from(this.state.storage.sql.exec<{ principal_id: string }>("INSERT OR IGNORE INTO audience_ballots (round_id, principal_id) VALUES (?, ?) RETURNING principal_id", body.promptId, principal.id));
		if (ballot.length !== 1) {
			if (body.commandId && claimedCommand) this.state.storage.sql.exec("DELETE FROM audience_commands WHERE round_id = ? AND command_id = ?", body.promptId, body.commandId);
			return Response.json({ accepted: true, duplicate: true, shardId: body.shardId }, { status: 202 });
		}
		const claimedIntent = Array.from(this.state.storage.sql.exec<{ command_id: string }>("INSERT OR IGNORE INTO submission_intents (command_id, room_id, prompt_id, shard_id, principal_id, choice, status) VALUES (?, ?, ?, ?, ?, ?, 'pending') RETURNING command_id", body.commandId, body.roomId, body.promptId, body.shardId, principal.id, choice));
		if (claimedIntent.length !== 1) {
			// A command ID already in flight for another prompt must not replace or
			// roll back that original durable intent.
			this.state.storage.sql.exec("DELETE FROM audience_ballots WHERE round_id = ? AND principal_id = ?", body.promptId, principal.id);
			this.state.storage.sql.exec("DELETE FROM audience_commands WHERE round_id = ? AND command_id = ?", body.promptId, body.commandId);
			return Response.json({ error: { code: "COMMAND_ID_CONFLICT" } }, { status: 409 });
		}
		const localVoteInterrupted = Array.from(this.state.storage.sql.exec<{ value: number }>("SELECT value FROM test_controls WHERE key = 'local-vote'"))[0]?.value ?? 0;
		if (localVoteInterrupted > 0) {
			this.state.storage.sql.exec("UPDATE test_controls SET value = value - 1 WHERE key = 'local-vote'");
			return Response.json({ accepted: true, recovering: true, shardId: body.shardId }, { status: 202 });
		}
		const game = this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName(body.roomId));
		let permitted: Response;
		try {
			permitted = await game.fetch("https://game-room.internal/_internal/audience-submit", { method: "POST", headers: { "content-type": "application/json", "x-arcade-principal": JSON.stringify({ id: "audience-shard", role: "producer" }) }, body: JSON.stringify({ promptId: body.promptId, commandId: body.commandId, shardId: body.shardId, choice }) });
		} catch {
			await this.scheduleFlush(1_000);
			return Response.json({ error: { code: "TEMPORARILY_UNAVAILABLE" } }, { status: 503 });
		}
		if (!permitted.ok) {
			if (permitted.status >= 500) {
				await this.scheduleFlush(1_000);
				return new Response(await permitted.text(), { status: permitted.status, headers: { "content-type": "application/json" } });
			}
			this.rollbackSubmissionIntent({ command_id: body.commandId, room_id: body.roomId, prompt_id: body.promptId, shard_id: body.shardId, principal_id: principal.id, choice });
			return new Response(await permitted.text(), { status: permitted.status, headers: { "content-type": "application/json" } });
		}
		const admission = await permitted.json<{ admissionVersion?: number }>();
		// This is a test-only interruption seam representing a restart after the
		// coordinator durably admitted the ballot but before this shard queued it.
		// The persisted intent is recovered by alarm without a client retry.
		const admissionResponseInterrupted = Array.from(this.state.storage.sql.exec<{ value: number }>("SELECT value FROM test_controls WHERE key = 'admission-response'"))[0]?.value ?? 0;
		if (admissionResponseInterrupted > 0) {
			this.state.storage.sql.exec("UPDATE test_controls SET value = value - 1 WHERE key = 'admission-response'");
			await this.scheduleFlush(10);
			return Response.json({ accepted: true, recovering: true, shardId: body.shardId }, { status: 202 });
		}
		this.commitSubmissionIntent({ command_id: body.commandId, room_id: body.roomId, prompt_id: body.promptId, shard_id: body.shardId, principal_id: principal.id, choice }, admission.admissionVersion);
		await this.scheduleFlush(100);
		return Response.json({ accepted: true, shardId: body.shardId }, { status: 202 });
	}

	private async submitReaction(principal: Principal, body: { roomId: string; reaction: string; promptId: string; shardId: string; commandId: string }): Promise<Response> {
		if (!body.roomId || !body.promptId || !body.reaction || body.reaction.length > 64) return new Response("Invalid reaction", { status: 400 });
		if (!body.commandId || typeof body.commandId !== "string" || body.commandId.trim().length === 0) return new Response("Command id required", { status: 400 });
		await this.scheduleFlush(100);
		const existingReactions = new Set(Array.from(this.state.storage.sql.exec<{ reaction: string }>("SELECT reaction FROM audience_reactions WHERE round_id = ?", body.promptId)).map((row) => row.reaction));
		const reaction = boundedAudienceBin(existingReactions, body.reaction);
		if (!reaction) return new Response("Invalid reaction", { status: 400 });
		const claimed = Array.from(this.state.storage.sql.exec<{ command_id: string }>("INSERT OR IGNORE INTO audience_reaction_commands (command_id) VALUES (?) RETURNING command_id", body.commandId));
		if (!claimed.length) return Response.json({ accepted: true, duplicate: true, shardId: body.shardId }, { status: 202 });
		this.state.storage.sql.exec("INSERT OR REPLACE INTO config (key, value) VALUES ('roomId', ?)", body.roomId);
		this.state.storage.sql.exec("INSERT OR REPLACE INTO config (key, value) VALUES ('promptId', ?)", body.promptId);
		this.state.storage.sql.exec("INSERT OR REPLACE INTO config (key, value) VALUES ('shardId', ?)", body.shardId);
		this.state.storage.sql.exec("INSERT OR REPLACE INTO config (key, value) VALUES ('mode', 'reaction')");
		this.state.storage.sql.exec("INSERT INTO audience_reactions (round_id, reaction, total) VALUES (?, ?, 1) ON CONFLICT(round_id, reaction) DO UPDATE SET total = total + 1", body.promptId, reaction);
		this.queueAck("reaction", body.promptId, body.commandId);
		this.queueFlush("reaction", body);
		await this.scheduleFlush(100);
		return Response.json({ accepted: true, shardId: body.shardId }, { status: 202 });
	}

	async alarm(): Promise<void> {
		let retry = await this.recoverSubmissionIntents();
		const queued = Array.from(this.state.storage.sql.exec<{ mode: "vote" | "reaction"; prompt_id: string; room_id: string; shard_id: string; admission_version: number | null }>("SELECT mode, prompt_id, room_id, shard_id, admission_version FROM pending_flushes ORDER BY prompt_id LIMIT 21"));
		const pending = queued.slice(0, 20);
		if (queued.length > pending.length) retry = true;
		for (const item of pending) {
			const totals = Object.fromEntries(Array.from(this.state.storage.sql.exec<{ choice: string; total: number }>("SELECT choice, total FROM audience_votes WHERE round_id = ?", item.prompt_id)).map((vote) => [vote.choice, vote.total]));
			const reactions = Object.fromEntries(Array.from(this.state.storage.sql.exec<{ reaction: string; total: number }>("SELECT reaction, total FROM audience_reactions WHERE round_id = ?", item.prompt_id)).map((row) => [row.reaction, row.total]));
			// Each aggregate frame is bounded, but no accepted command is discarded:
			// successful flushes drain only the exact IDs carried in that frame.
			const acknowledgements = Array.from(this.state.storage.sql.exec<{ sequence: number; command_id: string }>("SELECT sequence, command_id FROM pending_command_acks WHERE mode = ? AND prompt_id = ? ORDER BY sequence LIMIT 100", item.mode, item.prompt_id));
			const commandIds = acknowledgements.map((row) => row.command_id);
			const forcedFailure = Array.from(this.state.storage.sql.exec<{ value: number }>("SELECT value FROM test_controls WHERE key = 'flush'"))[0]?.value ?? 0;
			if (forcedFailure > 0) {
				this.state.storage.sql.exec("UPDATE test_controls SET value = value - 1 WHERE key = 'flush'");
				this.state.storage.sql.exec("UPDATE pending_flushes SET attempts = attempts + 1 WHERE mode = ? AND prompt_id = ?", item.mode, item.prompt_id);
				retry = true;
				continue;
			}
			const stub = this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName(item.room_id));
			const response = await stub.fetch("https://game-room.internal/_internal/audience-flush", {
				method: "POST",
				headers: { "content-type": "application/json", "x-arcade-principal": JSON.stringify({ id: "audience-shard", role: "producer" }) },
				body: JSON.stringify({ totals, reactions, mode: item.mode, shardId: item.shard_id, promptId: item.prompt_id, commandIds, admissionVersion: item.admission_version ?? undefined }),
			});
			if (!response.ok) {
				if (response.status >= 500 || response.status === 429) {
					this.state.storage.sql.exec("UPDATE pending_flushes SET attempts = attempts + 1 WHERE mode = ? AND prompt_id = ?", item.mode, item.prompt_id);
					retry = true;
				} else if (this.finalizePermanentFlush(item, acknowledgements)) retry = true;
				continue;
			}
			const committed = await response.json<{ version?: number; payload?: { totals?: Record<string, number>; reactions?: Record<string, number> } }>();
			if (acknowledgements.length) {
				this.state.storage.sql.exec("DELETE FROM pending_command_acks WHERE sequence <= ? AND mode = ? AND prompt_id = ?", acknowledgements.at(-1)?.sequence ?? 0, item.mode, item.prompt_id);
				if (item.mode === "vote") for (const commandId of commandIds) this.state.storage.sql.exec("DELETE FROM submission_intents WHERE command_id = ? AND prompt_id = ? AND shard_id = ?", commandId, item.prompt_id, item.shard_id);
			}
			const remaining = Array.from(this.state.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM pending_command_acks WHERE mode = ? AND prompt_id = ?", item.mode, item.prompt_id))[0]?.count ?? 0;
			if (remaining === 0) this.state.storage.sql.exec("DELETE FROM pending_flushes WHERE mode = ? AND prompt_id = ?", item.mode, item.prompt_id);
			else retry = true;
			const event = { v: PROTOCOL_VERSION, type: "event", version: committed.version ?? 0, event: "audience.aggregated", payload: { promptId: item.prompt_id, shardId: item.shard_id, commandIds, totals: committed.payload?.totals ?? totals, reactions: committed.payload?.reactions ?? reactions } };
			if (this.env.ENVIRONMENT === "test") this.state.storage.sql.exec("INSERT INTO test_event_log (event_json) VALUES (?)", JSON.stringify(event));
			for (const socket of this.state.getWebSockets()) socket.send(JSON.stringify(event));
		}
		if (retry) await this.scheduleFlush(10);
	}

	private finalizePermanentFlush(
		item: { mode: "vote" | "reaction"; prompt_id: string; shard_id: string },
		acknowledgements: Array<{ sequence: number; command_id: string }>,
	): boolean {
		return this.state.storage.transactionSync(() => {
			if (acknowledgements.length) {
				this.state.storage.sql.exec("DELETE FROM pending_command_acks WHERE sequence <= ? AND mode = ? AND prompt_id = ?", acknowledgements.at(-1)?.sequence ?? 0, item.mode, item.prompt_id);
				if (item.mode === "vote") for (const { command_id: commandId } of acknowledgements) this.state.storage.sql.exec("DELETE FROM submission_intents WHERE command_id = ? AND prompt_id = ? AND shard_id = ?", commandId, item.prompt_id, item.shard_id);
			}
			const remaining = Array.from(this.state.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM pending_command_acks WHERE mode = ? AND prompt_id = ?", item.mode, item.prompt_id))[0]?.count ?? 0;
			if (remaining > 0) return true;
			this.state.storage.sql.exec("DELETE FROM pending_flushes WHERE mode = ? AND prompt_id = ?", item.mode, item.prompt_id);
			if (item.mode === "vote") this.state.storage.sql.exec("DELETE FROM audience_votes WHERE round_id = ?", item.prompt_id);
			else this.state.storage.sql.exec("DELETE FROM audience_reactions WHERE round_id = ?", item.prompt_id);
			return false;
		});
	}

	private async recoverSubmissionIntents(): Promise<boolean> {
		const queued = Array.from(this.state.storage.sql.exec<SubmissionIntent>("SELECT command_id, room_id, prompt_id, shard_id, principal_id, choice FROM submission_intents WHERE status = 'pending' LIMIT 101"));
		const intents = queued.slice(0, 100);
		let retry = queued.length > intents.length;
		for (const intent of intents) {
			try {
				const response = await this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName(intent.room_id)).fetch("https://game-room.internal/_internal/audience-submit", { method: "POST", headers: { "content-type": "application/json", "x-arcade-principal": JSON.stringify({ id: "audience-shard", role: "producer" }) }, body: JSON.stringify({ promptId: intent.prompt_id, commandId: intent.command_id, shardId: intent.shard_id, choice: intent.choice }) });
				if (!response.ok) {
					if (response.status >= 500) retry = true;
					else this.rollbackSubmissionIntent(intent);
					continue;
				}
				const admission = await response.json<{ admissionVersion?: number }>();
				this.commitSubmissionIntent(intent, admission.admissionVersion);
			} catch {
				retry = true;
			}
		}
		return retry;
	}

	private commitSubmissionIntent(intent: SubmissionIntent, admissionVersion?: number): boolean {
		return this.state.storage.transactionSync(() => {
			const claimed = Array.from(this.state.storage.sql.exec<{ command_id: string }>("UPDATE submission_intents SET status = 'queued', admission_version = ? WHERE command_id = ? AND room_id = ? AND prompt_id = ? AND shard_id = ? AND principal_id = ? AND choice = ? AND status = 'pending' RETURNING command_id", admissionVersion ?? null, intent.command_id, intent.room_id, intent.prompt_id, intent.shard_id, intent.principal_id, intent.choice));
			if (claimed.length !== 1) return false;
			this.state.storage.sql.exec("INSERT OR REPLACE INTO config (key, value) VALUES ('roomId', ?)", intent.room_id);
			this.state.storage.sql.exec("INSERT OR REPLACE INTO config (key, value) VALUES ('promptId', ?)", intent.prompt_id);
			this.state.storage.sql.exec("INSERT OR REPLACE INTO config (key, value) VALUES ('shardId', ?)", intent.shard_id);
			this.state.storage.sql.exec("INSERT OR REPLACE INTO config (key, value) VALUES ('mode', 'vote')");
			const existing = new Set(Array.from(this.state.storage.sql.exec<{ choice: string }>("SELECT choice FROM audience_votes WHERE round_id = ?", intent.prompt_id)).map((row) => row.choice));
			const choice = boundedAudienceBin(existing, intent.choice);
			this.state.storage.sql.exec("INSERT INTO audience_votes (round_id, choice, total) VALUES (?, ?, 1) ON CONFLICT(round_id, choice) DO UPDATE SET total = total + 1", intent.prompt_id, choice);
			this.queueAck("vote", intent.prompt_id, intent.command_id);
			this.queueFlush("vote", { roomId: intent.room_id, promptId: intent.prompt_id, shardId: intent.shard_id }, admissionVersion);
			return true;
		});
	}

	private rollbackSubmissionIntent(intent: SubmissionIntent): void {
		this.state.storage.transactionSync(() => {
			const removed = Array.from(this.state.storage.sql.exec<{ command_id: string }>("DELETE FROM submission_intents WHERE command_id = ? AND room_id = ? AND prompt_id = ? AND shard_id = ? AND principal_id = ? AND choice = ? RETURNING command_id", intent.command_id, intent.room_id, intent.prompt_id, intent.shard_id, intent.principal_id, intent.choice));
			if (removed.length !== 1) return;
			this.state.storage.sql.exec("DELETE FROM audience_ballots WHERE round_id = ? AND principal_id = ?", intent.prompt_id, intent.principal_id);
			this.state.storage.sql.exec("DELETE FROM audience_commands WHERE round_id = ? AND command_id = ?", intent.prompt_id, intent.command_id);
		});
	}

	private queueFlush(mode: "vote" | "reaction", body: { roomId: string; promptId: string; shardId: string }, admissionVersion?: number): void {
		this.state.storage.sql.exec("INSERT INTO pending_flushes (mode, prompt_id, room_id, shard_id, admission_version) VALUES (?, ?, ?, ?, ?) ON CONFLICT(mode, prompt_id) DO UPDATE SET room_id = excluded.room_id, shard_id = excluded.shard_id, admission_version = MAX(pending_flushes.admission_version, excluded.admission_version)", mode, body.promptId, body.roomId, body.shardId, admissionVersion ?? null);
	}

	private queueAck(mode: "vote" | "reaction", promptId: string, commandId: string): void {
		this.state.storage.sql.exec("INSERT OR IGNORE INTO pending_command_acks (mode, prompt_id, command_id) VALUES (?, ?, ?)", mode, promptId, commandId);
	}

	private async scheduleFlush(delayMs: number): Promise<void> {
		const target = Date.now() + delayMs;
		const current = await this.state.storage.getAlarm();
		// setAlarm replaces the existing deadline. Preserve the first scheduled
		// flush under sustained traffic so arrivals cannot starve batching forever.
		if (current === null || current > target) await this.state.storage.setAlarm(target);
	}

	private setTestFailure(request: Request, key = "flush"): Response {
		if (this.env.ENVIRONMENT !== "test" || !this.env.E2E_SEED_SECRET || request.headers.get("x-arcade-test-secret") !== this.env.E2E_SEED_SECRET) return new Response("Not found", { status: 404 });
		this.state.storage.sql.exec("INSERT INTO test_controls (key, value) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET value = value + 1", key);
		return Response.json({ ok: true, key });
	}

	private testEvents(request: Request): Response {
		if (this.env.ENVIRONMENT !== "test" || !this.env.E2E_SEED_SECRET || request.headers.get("x-arcade-test-secret") !== this.env.E2E_SEED_SECRET) return new Response("Not found", { status: 404 });
		const events = Array.from(this.state.storage.sql.exec<{ event_json: string }>("SELECT event_json FROM test_event_log ORDER BY sequence")).map((row) => JSON.parse(row.event_json));
		return Response.json({ events });
	}

	private async testPending(request: Request): Promise<Response> {
		if (this.env.ENVIRONMENT !== "test" || !this.env.E2E_SEED_SECRET || request.headers.get("x-arcade-test-secret") !== this.env.E2E_SEED_SECRET) return new Response("Not found", { status: 404 });
		const pendingFlushes = Array.from(this.state.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM pending_flushes"))[0]?.count ?? 0;
		const pendingAcks = Array.from(this.state.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM pending_command_acks"))[0]?.count ?? 0;
		const pendingIntents = Array.from(this.state.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM submission_intents WHERE status = 'pending'"))[0]?.count ?? 0;
		const intents = Array.from(this.state.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM submission_intents"))[0]?.count ?? 0;
		return Response.json({ pendingFlushes, pendingAcks, pendingIntents, intents, alarm: await this.state.storage.getAlarm() });
	}

	private async recordPresence(roomId: string, shardId: string, principal: Principal, delta: 1 | -1): Promise<void> {
		try {
			const now = new Date().toISOString();
			await this.env.DB.prepare("INSERT INTO arcade_room_presence (room_id, principal_id, role, shard_id, connections, connected_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(room_id, principal_id) DO UPDATE SET role = excluded.role, shard_id = excluded.shard_id, connections = MAX(0, arcade_room_presence.connections + ?), connected_at = CASE WHEN arcade_room_presence.connections + ? > 0 THEN excluded.connected_at ELSE arcade_room_presence.connected_at END, last_seen_at = excluded.last_seen_at")
				.bind(roomId, principal.id, principal.role, shardId, Math.max(delta, 0), delta > 0 ? now : null, now, delta, delta).run();
		} catch (error) { console.error("arcade audience presence projection failed", error); }
	}

	private async publishAudiencePresence(roomId: string, shardId: string, principalId: string, connected: boolean): Promise<void> {
		try {
			await this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName(roomId)).fetch("https://game-room.internal/_internal/audience-presence", {
				method: "POST",
				headers: { "content-type": "application/json", "x-arcade-principal": JSON.stringify({ id: "audience-shard", role: "producer" }) },
				body: JSON.stringify({ shardId, principalId, connected }),
			});
		} catch (error) { console.error("arcade public audience presence failed", error); }
	}

	private allowFrame(socket: WebSocket, attachment: { rate?: { startedAt: number; frames: number } }): boolean {
		const now = Date.now();
		const rate = !attachment.rate || now - attachment.rate.startedAt >= 1_000 ? { startedAt: now, frames: 1 } : { ...attachment.rate, frames: attachment.rate.frames + 1 };
		attachment.rate = rate;
		socket.serializeAttachment(attachment);
		return rate.frames <= 30;
	}

	private principal(request: Request): Principal | undefined {
		const raw = request.headers.get("x-arcade-principal");
		if (!raw) return undefined;
		try { return JSON.parse(raw) as Principal; } catch { return undefined; }
	}
}
