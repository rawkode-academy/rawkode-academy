import type { Env } from "../env";
import { PROTOCOL_VERSION, type Principal } from "../domain/protocol";
import { boundedAudienceBin, normalizeAudienceChoice } from "../domain/audience-choice";

type SubmissionIntent = { command_id: string; room_id: string; prompt_id: string; shard_id: string; principal_id: string; choice: string };
type AdmissionResult = { commandId: string; accepted: boolean; admissionVersion?: number; committed?: boolean; code?: string };

/** Coalesces high-volume audience input before a single update is sent to the room actor. */
export class AudienceShard implements DurableObject {
	private registration?: Promise<string | undefined>;

	constructor(private readonly state: DurableObjectState, private readonly env: Env) {
		this.state.blockConcurrencyWhile(async () => {
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS audience_votes (round_id TEXT NOT NULL, choice TEXT NOT NULL, total INTEGER NOT NULL, PRIMARY KEY (round_id, choice))");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS audience_ballots (round_id TEXT NOT NULL, principal_id TEXT NOT NULL, PRIMARY KEY (round_id, principal_id))");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS used_tickets (nonce TEXT PRIMARY KEY, used_at TEXT NOT NULL)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS audience_commands (round_id TEXT NOT NULL, command_id TEXT NOT NULL, PRIMARY KEY (round_id, command_id))");
			try { this.state.storage.sql.exec("ALTER TABLE audience_commands ADD COLUMN principal_id TEXT"); } catch { /* Existing shard schema already has the column. */ }
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS audience_reactions (round_id TEXT NOT NULL, reaction TEXT NOT NULL, total INTEGER NOT NULL, PRIMARY KEY (round_id, reaction))");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS audience_reaction_commands (command_id TEXT PRIMARY KEY)");
			try { this.state.storage.sql.exec("ALTER TABLE audience_reaction_commands ADD COLUMN round_id TEXT"); } catch { /* Existing shard schema already has the column. */ }
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS pending_command_acks (sequence INTEGER PRIMARY KEY AUTOINCREMENT, mode TEXT NOT NULL, prompt_id TEXT NOT NULL, command_id TEXT NOT NULL, UNIQUE(mode, prompt_id, command_id))");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS submission_intents (command_id TEXT PRIMARY KEY, room_id TEXT NOT NULL, prompt_id TEXT NOT NULL, shard_id TEXT NOT NULL, principal_id TEXT NOT NULL, choice TEXT NOT NULL, status TEXT NOT NULL, admission_version INTEGER)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS audience_presence (principal_id TEXT PRIMARY KEY, connections INTEGER NOT NULL)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS presence_state (id INTEGER PRIMARY KEY CHECK (id = 1), room_id TEXT NOT NULL, shard_id TEXT NOT NULL, count INTEGER NOT NULL, sequence INTEGER NOT NULL, sent_sequence INTEGER NOT NULL DEFAULT -1, dirty INTEGER NOT NULL DEFAULT 1, next_at INTEGER NOT NULL DEFAULT 0)");
			try { this.state.storage.sql.exec("ALTER TABLE presence_state ADD COLUMN next_at INTEGER NOT NULL DEFAULT 0"); } catch { /* Existing shard schema already has the column. */ }
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
		await this.updatePresence(roomId, shardId, principal.id, 1);
		const snapshot = await this.audienceSnapshot(roomId, shardId);
		if (snapshot) server.send(snapshot);
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
		let roomStatus: string | undefined;
		try {
			const update = JSON.parse(payload) as { deliverySequence?: unknown; state?: { status?: unknown } };
			deliverySequence = update.deliverySequence as number | undefined;
			roomStatus = typeof update.state?.status === "string" ? update.state.status : undefined;
		} catch { return new Response("Invalid public update", { status: 400 }); }
		const previous = Array.from(this.state.storage.sql.exec<{ value: string }>("SELECT value FROM config WHERE key = 'deliverySequence'"))[0]?.value;
		if (typeof deliverySequence === "number" && Number.isSafeInteger(deliverySequence) && Number(previous ?? "-1") >= deliverySequence) return Response.json({ ok: true, ignored: true });
		if (typeof deliverySequence === "number" && Number.isSafeInteger(deliverySequence)) this.state.storage.sql.exec("INSERT OR REPLACE INTO config (key, value) VALUES ('deliverySequence', ?)", String(deliverySequence));
		this.state.storage.sql.exec("INSERT OR REPLACE INTO config (key, value) VALUES ('latestPublicSnapshot', ?)", payload);
		if (roomStatus) this.state.storage.sql.exec("INSERT OR REPLACE INTO config (key, value) VALUES ('roomStatus', ?)", roomStatus);
		if (roomStatus === "complete") {
			this.state.storage.sql.exec("INSERT OR IGNORE INTO config (key, value) VALUES ('completedAt', ?)", String(Date.now()));
			this.state.storage.sql.exec("INSERT OR REPLACE INTO config (key, value) VALUES ('latestCompleteSnapshot', ?)", payload);
			await this.scheduleFlush(24 * 60 * 60_000);
		}
		for (const socket of this.state.getWebSockets()) socket.send(payload);
		if (roomStatus === "complete") for (const socket of this.state.getWebSockets()) socket.close(1000, "Room complete");
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
		const queued = payload && typeof payload === "object" && (payload as { queued?: boolean }).queued === true;
		socket.send(JSON.stringify({ v: PROTOCOL_VERSION, type: "event", version: 0, event: queued ? "audience.queued" : "audience.accepted", payload, commandId: input.id }));
	}

	async webSocketClose(socket: WebSocket): Promise<void> {
		// Older compatibility dates require a reciprocal close frame. Finish the
		// handshake before presence I/O; never echo reserved codes such as 1006.
		if (socket.readyState !== WebSocket.CLOSED) socket.close(1000, "Connection closed");
		const attachment = socket.deserializeAttachment() as { principal: Principal; roomId: string; shardId: string } | null;
		if (attachment) await this.updatePresence(attachment.roomId, attachment.shardId, attachment.principal.id, -1);
	}

	private async submit(principal: Principal, body: { roomId: string; choice: string; promptId: string; shardId: string; commandId?: string }): Promise<Response> {
		if (!body.roomId || !body.promptId || !body.choice || body.choice.length > 100) return new Response("Invalid vote", { status: 400 });
		if (!body.commandId || typeof body.commandId !== "string" || body.commandId.trim().length === 0) return new Response("Command id required", { status: 400 });
		const roomStatus = Array.from(this.state.storage.sql.exec<{ value: string }>("SELECT value FROM config WHERE key = 'roomStatus'"))[0]?.value;
		if (roomStatus === "complete" || roomStatus === "paused") return Response.json({ error: { code: roomStatus === "complete" ? "ROOM_COMPLETE" : "ROOM_PAUSED" } }, { status: 409 });
		// Persist the wake-up before any local claim. A restart can therefore leave
		// either no work or recoverable work, never a stranded durable intent.
		await this.scheduleFlush(25);
		const choice = normalizeAudienceChoice(body.choice);
		if (!choice) return new Response("Invalid vote", { status: 400 });
		// Claim the command first, then the one-ballot identity slot, before the
		// coordinator can create an admission. This ordering handles both a fresh
		// command from an already-voted identity and two identities racing the same
		// command ID without leaving a remote drain barrier behind.
		let claimedCommand = false;
		if (body.commandId) {
			claimedCommand = Array.from(this.state.storage.sql.exec<{ command_id: string }>("INSERT OR IGNORE INTO audience_commands (round_id, command_id, principal_id) VALUES (?, ?, ?) RETURNING command_id", body.promptId, body.commandId, principal.id)).length === 1;
			if (!claimedCommand) {
				const existing = Array.from(this.state.storage.sql.exec<{ status: string; room_id: string; prompt_id: string; shard_id: string; principal_id: string; choice: string }>("SELECT status, room_id, prompt_id, shard_id, principal_id, choice FROM submission_intents WHERE command_id = ?", body.commandId))[0];
				if (existing && (existing.room_id !== body.roomId || existing.prompt_id !== body.promptId || existing.shard_id !== body.shardId || existing.principal_id !== principal.id || existing.choice !== choice)) return Response.json({ error: { code: "COMMAND_ID_CONFLICT" } }, { status: 409 });
				const owner = Array.from(this.state.storage.sql.exec<{ principal_id: string | null }>("SELECT principal_id FROM audience_commands WHERE round_id = ? AND command_id = ?", body.promptId, body.commandId))[0]?.principal_id;
				if (!existing && owner !== principal.id) return Response.json({ error: { code: "COMMAND_ID_CONFLICT" } }, { status: 409 });
				return Response.json({ ...(existing?.status === "queued" ? { accepted: true } : {}), queued: existing?.status === "pending", settled: !existing, duplicate: true, shardId: body.shardId }, { status: 202 });
			}
		}
		const ballot = Array.from(this.state.storage.sql.exec<{ principal_id: string }>("INSERT OR IGNORE INTO audience_ballots (round_id, principal_id) VALUES (?, ?) RETURNING principal_id", body.promptId, principal.id));
		if (ballot.length !== 1) {
			if (body.commandId && claimedCommand) this.state.storage.sql.exec("DELETE FROM audience_commands WHERE round_id = ? AND command_id = ?", body.promptId, body.commandId);
			return Response.json({ error: { code: "ALREADY_VOTED" } }, { status: 409 });
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
			return Response.json({ queued: true, recovering: true, shardId: body.shardId }, { status: 202 });
		}
		return Response.json({ queued: true, shardId: body.shardId }, { status: 202 });
	}

	private async submitReaction(principal: Principal, body: { roomId: string; reaction: string; promptId: string; shardId: string; commandId: string }): Promise<Response> {
		if (!body.roomId || !body.promptId || !body.reaction || body.reaction.length > 64) return new Response("Invalid reaction", { status: 400 });
		if (!body.commandId || typeof body.commandId !== "string" || body.commandId.trim().length === 0) return new Response("Command id required", { status: 400 });
		const roomStatus = Array.from(this.state.storage.sql.exec<{ value: string }>("SELECT value FROM config WHERE key = 'roomStatus'"))[0]?.value;
		if (roomStatus === "complete" || roomStatus === "paused") return Response.json({ error: { code: roomStatus === "complete" ? "ROOM_COMPLETE" : "ROOM_PAUSED" } }, { status: 409 });
		await this.scheduleFlush(100);
		const existingReactions = new Set(Array.from(this.state.storage.sql.exec<{ reaction: string }>("SELECT reaction FROM audience_reactions WHERE round_id = ?", body.promptId)).map((row) => row.reaction));
		const reaction = boundedAudienceBin(existingReactions, body.reaction);
		if (!reaction) return new Response("Invalid reaction", { status: 400 });
		const claimed = Array.from(this.state.storage.sql.exec<{ command_id: string }>("INSERT OR IGNORE INTO audience_reaction_commands (command_id, round_id) VALUES (?, ?) RETURNING command_id", body.commandId, body.promptId));
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
		let nextAlarm = await this.publishAudiencePresence();
		let retry = false;
		if (await this.recoverSubmissionIntents()) retry = true;
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
		this.compactLocalHistory();
		// An alarm may fire a few milliseconds before its stored timestamp. Always
		// replace the firing alarm directly when durable work remains; comparing the
		// old timestamp here can otherwise strand a retry as the callback returns.
		if (retry) nextAlarm = Date.now() + 10;
		else {
			const retentionDeadline = this.retentionDeadline();
			if (retentionDeadline !== undefined) nextAlarm = nextAlarm === undefined ? retentionDeadline : Math.min(nextAlarm, retentionDeadline);
		}
		if (nextAlarm !== undefined) await this.state.storage.setAlarm(nextAlarm);
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
		const first = Array.from(this.state.storage.sql.exec<SubmissionIntent>("SELECT command_id, room_id, prompt_id, shard_id, principal_id, choice FROM submission_intents WHERE status = 'pending' ORDER BY rowid LIMIT 1"))[0];
		if (!first) return false;
		const queued = Array.from(this.state.storage.sql.exec<SubmissionIntent>("SELECT command_id, room_id, prompt_id, shard_id, principal_id, choice FROM submission_intents WHERE status = 'pending' AND room_id = ? AND prompt_id = ? AND shard_id = ? ORDER BY rowid LIMIT 101", first.room_id, first.prompt_id, first.shard_id));
		const intents = queued.slice(0, 100);
		const otherPending = Array.from(this.state.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM submission_intents WHERE status = 'pending' AND NOT (room_id = ? AND prompt_id = ? AND shard_id = ?)", first.room_id, first.prompt_id, first.shard_id))[0]?.count ?? 0;
		let retry = queued.length > intents.length || otherPending > 0;
		try {
			const response = await this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName(first.room_id)).fetch("https://game-room.internal/_internal/audience-submit-batch", {
				method: "POST",
				headers: { "content-type": "application/json", "x-arcade-principal": JSON.stringify({ id: "audience-shard", role: "producer" }) },
				body: JSON.stringify({ shardId: first.shard_id, promptId: first.prompt_id, submissions: intents.map((intent) => ({ commandId: intent.command_id, choice: intent.choice })) }),
			});
			if (!response.ok) return true;
			const { results } = await response.json<{ results?: AdmissionResult[] }>();
			if (!Array.isArray(results)) return true;
			const byCommand = new Map(results.map((result) => [result.commandId, result]));
			const admissionResponseInterrupted = Array.from(this.state.storage.sql.exec<{ value: number }>("SELECT value FROM test_controls WHERE key = 'admission-response'"))[0]?.value ?? 0;
			if (admissionResponseInterrupted > 0) {
				this.state.storage.sql.exec("UPDATE test_controls SET value = value - 1 WHERE key = 'admission-response'");
				return true;
			}
			for (const intent of intents) {
				const result = byCommand.get(intent.command_id);
				if (!result || result.code === "TEMPORARILY_UNAVAILABLE") {
					retry = true;
					continue;
				}
				if (result.accepted) this.commitSubmissionIntent(intent, result.admissionVersion);
				else {
					this.rollbackSubmissionIntent(intent);
					this.notifyRejectedIntent(intent, result.code ?? "BAD_COMMAND");
				}
			}
		} catch {
			return true;
		}
		return retry;
	}

	private commitSubmissionIntent(intent: SubmissionIntent, admissionVersion?: number): boolean {
		const committed = this.state.storage.transactionSync(() => {
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
		if (committed) {
			const event = JSON.stringify({ v: PROTOCOL_VERSION, type: "event", version: admissionVersion ?? 0, event: "audience.accepted", payload: { shardId: intent.shard_id, admissionVersion }, commandId: intent.command_id });
			for (const socket of this.state.getWebSockets()) {
				const attachment = socket.deserializeAttachment() as { principal?: Principal } | null;
				if (attachment?.principal?.id === intent.principal_id) socket.send(event);
			}
		}
		return committed;
	}

	private rollbackSubmissionIntent(intent: SubmissionIntent): void {
		this.state.storage.transactionSync(() => {
			const removed = Array.from(this.state.storage.sql.exec<{ command_id: string }>("DELETE FROM submission_intents WHERE command_id = ? AND room_id = ? AND prompt_id = ? AND shard_id = ? AND principal_id = ? AND choice = ? RETURNING command_id", intent.command_id, intent.room_id, intent.prompt_id, intent.shard_id, intent.principal_id, intent.choice));
			if (removed.length !== 1) return;
			this.state.storage.sql.exec("DELETE FROM audience_ballots WHERE round_id = ? AND principal_id = ?", intent.prompt_id, intent.principal_id);
			this.state.storage.sql.exec("DELETE FROM audience_commands WHERE round_id = ? AND command_id = ?", intent.prompt_id, intent.command_id);
		});
	}

	private notifyRejectedIntent(intent: SubmissionIntent, code: string): void {
		const event = JSON.stringify({ v: PROTOCOL_VERSION, type: "error", code: ["DISTRIBUTION_FROZEN", "STALE_PROMPT", "ROOM_PAUSED", "ROOM_COMPLETE", "COMMAND_ID_CONFLICT"].includes(code) ? "CONFLICT" : "BAD_COMMAND", message: code, commandId: intent.command_id });
		for (const socket of this.state.getWebSockets()) {
			const attachment = socket.deserializeAttachment() as { principal?: Principal } | null;
			if (attachment?.principal?.id === intent.principal_id) socket.send(event);
		}
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
		// During an alarm callback getAlarm may still expose the firing deadline;
		// replace that expired value so retries cannot become stranded.
		if (current === null || current <= Date.now() || current > target) await this.state.storage.setAlarm(target);
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

	private async updatePresence(roomId: string, shardId: string, principalId: string, delta: 1 | -1): Promise<void> {
		this.state.storage.transactionSync(() => {
			const existing = Array.from(this.state.storage.sql.exec<{ connections: number }>("SELECT connections FROM audience_presence WHERE principal_id = ?", principalId))[0]?.connections ?? 0;
			const connections = Math.max(0, existing + delta);
			if (connections === 0) this.state.storage.sql.exec("DELETE FROM audience_presence WHERE principal_id = ?", principalId);
			else this.state.storage.sql.exec("INSERT OR REPLACE INTO audience_presence (principal_id, connections) VALUES (?, ?)", principalId, connections);
			// Multiple tabs for one principal count once. Only a zero/non-zero edge
			// advances the absolute shard sequence sent to the coordinator.
			if ((existing === 0) === (connections === 0)) return;
			const count = Array.from(this.state.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM audience_presence"))[0]?.count ?? 0;
			this.state.storage.sql.exec("INSERT INTO presence_state (id, room_id, shard_id, count, sequence, sent_sequence, dirty, next_at) VALUES (1, ?, ?, ?, 1, -1, 1, ?) ON CONFLICT(id) DO UPDATE SET room_id = excluded.room_id, shard_id = excluded.shard_id, count = excluded.count, sequence = presence_state.sequence + 1, next_at = CASE WHEN presence_state.dirty = 1 THEN presence_state.next_at ELSE excluded.next_at END, dirty = 1", roomId, shardId, count, Date.now() + 250);
		});
		await this.scheduleFlush(250);
	}

	private async publishAudiencePresence(): Promise<number | undefined> {
		const presence = Array.from(this.state.storage.sql.exec<{ room_id: string; shard_id: string; count: number; sequence: number; next_at: number }>("SELECT room_id, shard_id, count, sequence, next_at FROM presence_state WHERE id = 1 AND dirty = 1"))[0];
		if (!presence) return undefined;
		if (presence.next_at > Date.now()) return presence.next_at;
		try {
			const response = await this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName(presence.room_id)).fetch("https://game-room.internal/_internal/audience-presence", {
				method: "POST",
				headers: { "content-type": "application/json", "x-arcade-principal": JSON.stringify({ id: "audience-shard", role: "producer" }) },
				body: JSON.stringify({ shardId: presence.shard_id, count: presence.count, sequence: presence.sequence }),
			});
			if (!response.ok) return Date.now() + 1_000;
			this.state.storage.sql.exec("UPDATE presence_state SET sent_sequence = ?, dirty = CASE WHEN sequence = ? THEN 0 ELSE 1 END, next_at = CASE WHEN sequence = ? THEN next_at ELSE ? END WHERE id = 1", presence.sequence, presence.sequence, presence.sequence, Date.now() + 250);
			const remaining = Array.from(this.state.storage.sql.exec<{ next_at: number }>("SELECT next_at FROM presence_state WHERE id = 1 AND dirty = 1"))[0];
			return remaining?.next_at;
		} catch (error) {
			console.error("arcade public audience presence failed", error);
			return Date.now() + 1_000;
		}
	}

	private async audienceSnapshot(roomId: string, shardId: string): Promise<string | undefined> {
		const cached = Array.from(this.state.storage.sql.exec<{ value: string }>("SELECT value FROM config WHERE key = 'latestPublicSnapshot'"))[0]?.value;
		if (cached) return cached;
		this.registration ??= (async () => {
			try {
				const game = this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName(roomId));
				const response = await game.fetch("https://game-room.internal/_internal/audience-register", { method: "POST", headers: { "content-type": "application/json", "x-arcade-principal": JSON.stringify({ id: "audience-shard", role: "producer" }) }, body: JSON.stringify({ shardId }) });
				if (!response.ok) return undefined;
				const snapshot = await response.text();
				let snapshotSequence = -1;
				try { snapshotSequence = Number((JSON.parse(snapshot) as { deliverySequence?: unknown }).deliverySequence ?? -1); } catch { /* Return but do not cache a malformed coordinator response. */ }
				const currentSequence = Number(Array.from(this.state.storage.sql.exec<{ value: string }>("SELECT value FROM config WHERE key = 'deliverySequence'"))[0]?.value ?? -1);
				if (Number.isSafeInteger(snapshotSequence) && snapshotSequence >= currentSequence) this.state.storage.sql.exec("INSERT OR REPLACE INTO config (key, value) VALUES ('latestPublicSnapshot', ?)", snapshot);
				return snapshot;
			} finally {
				this.registration = undefined;
			}
		})();
		return this.registration;
	}

	/** Prune only settled generations; pending admissions and flushes survive. */
	private compactLocalHistory(): void {
		this.state.storage.sql.exec("DELETE FROM used_tickets WHERE used_at < ?", new Date(Date.now() - 10 * 60_000).toISOString());
		const currentPrompt = Array.from(this.state.storage.sql.exec<{ value: string }>("SELECT value FROM config WHERE key = 'promptId'"))[0]?.value;
		if (currentPrompt) {
			for (const table of ["audience_votes", "audience_ballots", "audience_commands", "audience_reactions"] as const) {
				this.state.storage.sql.exec(`DELETE FROM ${table} WHERE round_id != ? AND round_id NOT IN (SELECT prompt_id FROM pending_flushes) AND round_id NOT IN (SELECT prompt_id FROM submission_intents)`, currentPrompt);
			}
			this.state.storage.sql.exec("DELETE FROM audience_reaction_commands WHERE round_id IS NOT NULL AND round_id != ? AND round_id NOT IN (SELECT prompt_id FROM pending_flushes)", currentPrompt);
		}
		const completedAt = Number(Array.from(this.state.storage.sql.exec<{ value: string }>("SELECT value FROM config WHERE key = 'completedAt'"))[0]?.value ?? "NaN");
		if (Number.isFinite(completedAt) && Date.now() - completedAt >= 24 * 60 * 60_000) {
			this.state.storage.sql.exec("DELETE FROM audience_votes WHERE round_id NOT IN (SELECT prompt_id FROM pending_flushes)");
			this.state.storage.sql.exec("DELETE FROM audience_ballots WHERE round_id NOT IN (SELECT prompt_id FROM submission_intents)");
			this.state.storage.sql.exec("DELETE FROM audience_commands WHERE round_id NOT IN (SELECT prompt_id FROM submission_intents)");
			this.state.storage.sql.exec("DELETE FROM audience_reactions WHERE round_id NOT IN (SELECT prompt_id FROM pending_flushes)");
			this.state.storage.sql.exec("DELETE FROM audience_reaction_commands WHERE round_id IS NOT NULL AND round_id NOT IN (SELECT prompt_id FROM pending_flushes)");
			const pending = Array.from(this.state.storage.sql.exec<{ count: number }>("SELECT (SELECT COUNT(*) FROM submission_intents) + (SELECT COUNT(*) FROM pending_flushes) + (SELECT COUNT(*) FROM pending_command_acks) AS count"))[0]?.count ?? 0;
			if (pending === 0 && this.state.getWebSockets().length === 0) {
				this.state.storage.sql.exec("DELETE FROM audience_presence");
				this.state.storage.sql.exec("DELETE FROM presence_state");
			}
		}
	}

	private retentionDeadline(): number | undefined {
		const completedAt = Number(Array.from(this.state.storage.sql.exec<{ value: string }>("SELECT value FROM config WHERE key = 'completedAt'"))[0]?.value ?? "NaN");
		if (!Number.isFinite(completedAt)) return undefined;
		const deadline = completedAt + 24 * 60 * 60_000;
		return deadline > Date.now() ? deadline : undefined;
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
