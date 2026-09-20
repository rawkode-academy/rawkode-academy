import { applyCommand, canonicalAudienceChoice } from "../domain/registry";
import { validAudienceTotals } from "../domain/audience-choice";
import { newGameState, type GameState } from "../domain/engine";
import { redactSnapshot } from "../domain/redaction";
import { PROTOCOL_VERSION, type CommandEnvelope, type EventMessage, type Principal, type ServerMessage } from "../domain/protocol";
import type { Env } from "../env";
import { ResultProjector } from "../server/results";

type PersistedRow = { value: string };
type Attachment = { principal: Principal; rate?: { startedAt: number; frames: number } };

const internal = "https://game-room.internal";

/**
 * The authoritative room actor. Durable Object input is serialized, making the
 * compare-and-apply command path and buzzer claim atomic without a distributed lock.
 */
export class GameRoom implements DurableObject {
	private readonly testAdmissionBarrierWaiters: Record<"before" | "after", Array<() => void>> = { before: [], after: [] };

	constructor(private readonly state: DurableObjectState, private readonly env: Env) {
		this.state.blockConcurrencyWhile(async () => {
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS room_state (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS commands (id TEXT PRIMARY KEY, response_json TEXT NOT NULL)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS replay_events (version INTEGER PRIMARY KEY, event_json TEXT NOT NULL)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS buzzers (prompt_id TEXT PRIMARY KEY, principal_id TEXT NOT NULL, at TEXT NOT NULL)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS used_tickets (nonce TEXT PRIMARY KEY, used_at TEXT NOT NULL)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS audience_shards (shard_id TEXT PRIMARY KEY)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS audience_admissions (command_id TEXT PRIMARY KEY, prompt_id TEXT NOT NULL, admission_version INTEGER NOT NULL, shard_id TEXT NOT NULL)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS audience_admission_intents (admission_key TEXT PRIMARY KEY, command_id TEXT NOT NULL, prompt_id TEXT NOT NULL, admission_version INTEGER NOT NULL, shard_id TEXT NOT NULL, canonical_choice TEXT, committed INTEGER NOT NULL DEFAULT 0)");
			try { this.state.storage.sql.exec("ALTER TABLE audience_admission_intents ADD COLUMN committed INTEGER NOT NULL DEFAULT 0"); } catch { /* Existing room schema already has the column. */ }
			try { this.state.storage.sql.exec("ALTER TABLE audience_admission_intents ADD COLUMN canonical_choice TEXT"); } catch { /* Existing room schema already has the column. */ }
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS fanout_queue (shard_id TEXT PRIMARY KEY, delivery_sequence INTEGER NOT NULL, snapshot_json TEXT NOT NULL)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS publication_intent (id INTEGER PRIMARY KEY CHECK (id = 1), requested_at TEXT NOT NULL)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS delivery_state (id INTEGER PRIMARY KEY CHECK (id = 1), sequence INTEGER NOT NULL)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS outbox (sequence INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, payload_json TEXT NOT NULL, occurred_at TEXT NOT NULL)");
			this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS test_controls (key TEXT PRIMARY KEY, value INTEGER NOT NULL)");
		});
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === "/_internal/init" && request.method === "POST") {
			const body = await request.json<{ roomId: string; gameKey: string; content?: GameState["private"]["contentSnapshot"] }>();
			if (!this.load()) {
				const game = newGameState(body.roomId, body.gameKey);
				if (body.content) {
					game.contentRevision = { id: body.content.revisionId, checksum: body.content.checksum };
					game.private.contentSnapshot = structuredClone(body.content);
				}
				this.save(game);
			}
			return Response.json({ ok: true });
		}
		if (url.pathname === "/_internal/state") {
			const game = this.load();
			const principal = this.principal(request);
			if (!game || !principal) return new Response("Unauthorized", { status: 401 });
			return Response.json(this.snapshot(game, principal, this.currentDeliverySequence()));
		}
		if (url.pathname === "/_internal/replay") return this.replay(request);
		if (url.pathname === "/_internal/audience-register" && request.method === "POST") return this.registerAudienceShard(request);
		if (url.pathname === "/_internal/audience-submit" && request.method === "POST") return this.canAcceptAudience(request);
		if (url.pathname === "/_internal/audience-presence" && request.method === "POST") return this.audiencePresence(request);
		if (url.pathname === "/_internal/connect") return this.upgrade(request);
		if (url.pathname === "/_internal/command" && request.method === "POST") return this.command(request);
		if (url.pathname === "/_internal/audience-flush" && request.method === "POST") return this.flushAudience(request);
		if (url.pathname === "/_internal/testing/fail-next-outbox" && request.method === "POST") return this.setTestFailure(request, "outbox");
		if (url.pathname === "/_internal/testing/fail-next-projection" && request.method === "POST") return this.setTestFailure(request, "projection");
		if (url.pathname === "/_internal/testing/fail-next-terminal-delivery" && request.method === "POST") return this.setTestFailure(request, "terminal-delivery");
		if (url.pathname === "/_internal/testing/fail-next-audience-admission" && request.method === "POST") return this.setTestFailure(request, "audience-admission");
		if (url.pathname === "/_internal/testing/delay-next-audience-admission" && request.method === "POST") return this.setTestFailure(request, "audience-admission-delay");
		if (url.pathname === "/_internal/testing/delay-next-before-audience-admission" && request.method === "POST") return this.setTestFailure(request, "audience-admission-before-delay");
		if (url.pathname === "/_internal/testing/hold-next-audience-admission" && request.method === "POST") return this.setTestFailure(request, "audience-admission-hold-after");
		if (url.pathname === "/_internal/testing/hold-next-before-audience-admission" && request.method === "POST") return this.setTestFailure(request, "audience-admission-hold-before");
		if (url.pathname === "/_internal/testing/audience-admission-barriers" && request.method === "GET") return this.testAdmissionBarriers(request);
		if (url.pathname === "/_internal/testing/release-audience-admission" && request.method === "POST") return this.releaseTestAdmissionBarrier(request, url.searchParams.get("phase"));
		return new Response("Not found", { status: 404 });
	}

	private load(): GameState | undefined {
		const row = Array.from(this.state.storage.sql.exec<PersistedRow>("SELECT value FROM room_state WHERE id = 1"))[0];
		return row ? JSON.parse(row.value) as GameState : undefined;
	}

	private save(game: GameState): void {
		this.state.storage.sql.exec("INSERT OR REPLACE INTO room_state (id, value) VALUES (1, ?)", JSON.stringify(game));
	}

	private principal(request: Request): Principal | undefined {
		const raw = request.headers.get("x-arcade-principal");
		if (!raw) return undefined;
		try { return JSON.parse(raw) as Principal; } catch { return undefined; }
	}

	private snapshot(game: GameState, principal: Principal, deliverySequence?: number): ServerMessage {
		return { v: PROTOCOL_VERSION, type: "snapshot", version: game.version, state: redactSnapshot(game, principal), serverTime: new Date().toISOString(), ...(deliverySequence === undefined ? {} : { deliverySequence }) };
	}

	private async upgrade(request: Request): Promise<Response> {
		if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected websocket", { status: 426 });
		const principal = this.principal(request);
		const game = this.load();
		if (!principal || !game) return new Response("Unauthorized", { status: 401 });
		const nonce = request.headers.get("x-arcade-ticket-nonce");
		const claimedTicket = nonce ? Array.from(this.state.storage.sql.exec<{ nonce: string }>("INSERT OR IGNORE INTO used_tickets (nonce, used_at) VALUES (?, ?) RETURNING nonce", nonce, new Date().toISOString())) : [];
		if (claimedTicket.length !== 1) {
			return new Response("Ticket has already been used", { status: 401 });
		}
		const pair = new WebSocketPair();
		const client = pair[0];
		const server = pair[1];
		this.state.acceptWebSocket(server, [principal.role]);
		server.serializeAttachment({ principal } satisfies Attachment);
		server.send(JSON.stringify(this.snapshot(game, principal, this.currentDeliverySequence())));
		await this.recordPresence(game.roomId, principal, 1);
		return this.websocketResponse(client, request);
	}

	async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
		const attachment = socket.deserializeAttachment() as Attachment | null;
		const principal = attachment?.principal;
		if (!attachment || !principal) return socket.close(1008, "Session missing");
		const bytes = typeof message === "string" ? new TextEncoder().encode(message).byteLength : message.byteLength;
		if (bytes > 8_192) return this.send(socket, this.error("BAD_COMMAND", "Message exceeds 8 KiB"));
		if (!this.allowFrame(socket, attachment)) return this.send(socket, this.error("RATE_LIMITED", "Too many messages"));
		let parsed: unknown;
		try { parsed = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message)); } catch { return this.send(socket, this.error("BAD_COMMAND", "Invalid JSON")); }
		if ((parsed as { type?: string }).type === "ping") return this.send(socket, { v: PROTOCOL_VERSION, type: "pong" });
		if (!parsed || typeof parsed !== "object") return this.send(socket, this.error("BAD_COMMAND", "Invalid command"));
		await this.scheduleRecovery();
		const response = await this.apply(parsed as CommandEnvelope, principal);
		this.send(socket, response);
	}

	async webSocketClose(socket: WebSocket): Promise<void> {
		const attachment = socket.deserializeAttachment() as Attachment | null;
		const game = this.load();
		if (attachment && game) await this.recordPresence(game.roomId, attachment.principal, -1);
	}

	async alarm(): Promise<void> {
		await this.deliverOutbox();
		// A terminal event can have reached D1 only after a retry; drain its
		// idempotent projection checkpoint on every successful wake-up.
		await this.consumeProjectedOutbox();
		// A publication intent is committed with each authoritative state mutation.
		// It survives eviction before the request path can stage shard fanout.
		if (this.hasPublicationIntent()) await this.publishCurrent();
		else await this.deliverAudienceShardFanout();
	}

	private async scheduleRecovery(delayMs = 100): Promise<void> {
		const target = Date.now() + delayMs;
		const current = await this.state.storage.getAlarm();
		if (current === null || current > target) await this.state.storage.setAlarm(target);
	}

	private async command(request: Request): Promise<Response> {
		const principal = this.principal(request);
		if (!principal) return new Response("Unauthorized", { status: 401 });
		const command = await request.json<CommandEnvelope>();
		// Arm the wake-up before apply loads or commits state. A crash can therefore
		// leave either a harmless alarm for the old state or a recoverable intent
		// for the new state, never committed work without a wake-up.
		await this.scheduleRecovery();
		const response = await this.apply(command, principal);
		return Response.json(response, { status: response.type === "error" && response.code === "FORBIDDEN" ? 403 : 200 });
	}

	private async registerAudienceShard(request: Request): Promise<Response> {
		const principal = this.principal(request);
		const body = await request.json<{ shardId: string }>();
		const game = this.load();
		if (!principal || principal.role !== "producer" || !game || !body.shardId) return new Response("Forbidden", { status: 403 });
		this.state.storage.sql.exec("INSERT OR IGNORE INTO audience_shards (shard_id) VALUES (?)", body.shardId);
		return Response.json(this.snapshot(game, { id: "audience-shard", role: "audience" }, this.currentDeliverySequence()));
	}

	private async canAcceptAudience(request: Request): Promise<Response> {
		const principal = this.principal(request);
		const body = await request.json<{ promptId: string; commandId?: string; shardId?: string; choice?: string }>();
		const game = this.load();
		if (!principal || principal.role !== "producer" || !game) return new Response("Forbidden", { status: 403 });
		if (!body.commandId || !body.shardId) return Response.json({ error: { code: "BAD_COMMAND" } }, { status: 400 });
		const admissionKey = `${body.shardId}:${body.commandId}`;
		if (this.env.ENVIRONMENT === "test") await this.waitAtTestAdmissionBarrier("before");
		if (this.consumeTestControl("audience-admission-before-delay")) await new Promise((resolve) => setTimeout(resolve, 500));
		const existing = Array.from(this.state.storage.sql.exec<{ admission_version: number; prompt_id: string; canonical_choice: string | null; committed: number }>("SELECT admission_version, prompt_id, canonical_choice, committed FROM audience_admission_intents WHERE admission_key = ?", admissionKey))[0];
		if (existing) return existing.prompt_id === body.promptId
			? Response.json({ accepted: true, admissionVersion: existing.admission_version, committed: existing.committed === 1 }, { status: 202 })
			: Response.json({ error: { code: "COMMAND_ID_CONFLICT" } }, { status: 409 });
		if (this.consumeTestControl("audience-admission")) return Response.json({ error: { code: "TEMPORARILY_UNAVAILABLE" } }, { status: 503 });
		if (game.audience.frozen) return Response.json({ error: { code: "DISTRIBUTION_FROZEN" } }, { status: 409 });
		if (game.activePrompt && game.activePrompt.id !== body.promptId) return Response.json({ error: { code: "STALE_PROMPT" } }, { status: 409 });
		const canonicalChoice = typeof body.choice === "string" ? canonicalAudienceChoice(game, body.choice) : undefined;
		this.state.storage.sql.exec("INSERT OR IGNORE INTO audience_admission_intents (admission_key, command_id, prompt_id, admission_version, shard_id, canonical_choice) VALUES (?, ?, ?, ?, ?, ?)", admissionKey, body.commandId, body.promptId, game.version, body.shardId, canonicalChoice ?? null);
		if (this.env.ENVIRONMENT === "test") await this.waitAtTestAdmissionBarrier("after");
		if (this.consumeTestControl("audience-admission-delay")) await new Promise((resolve) => setTimeout(resolve, 500));
		return Response.json({ accepted: true, admissionVersion: game.version }, { status: 202 });
	}


	private async audiencePresence(request: Request): Promise<Response> {
		const principal = this.principal(request);
		const body = await request.json<{ shardId: string; principalId: string; connected: boolean }>();
		await this.scheduleRecovery();
		const game = this.load();
		if (!principal || principal.role !== "producer" || !game || !body.shardId || !body.principalId) return new Response("Forbidden", { status: 403 });
		const next = structuredClone(game);
		next.private.audiencePresence ??= {};
		next.private.audiencePresence[body.shardId] ??= {};
		if (body.connected) next.private.audiencePresence[body.shardId][body.principalId] = true;
		else delete next.private.audiencePresence[body.shardId][body.principalId];
		next.audienceCount = Object.values(next.private.audiencePresence).reduce((count, shard) => count + Object.keys(shard).length, 0);
		this.state.storage.transactionSync(() => {
			this.save(next);
			this.markPublicationIntent();
		});
		await this.publishCurrent();
		return Response.json({ audienceCount: next.audienceCount, version: next.version });
	}

	private replay(request: Request): Response {
		const game = this.load();
		const principal = this.principal(request);
		if (!game || !principal) return new Response("Unauthorized", { status: 401 });
		const after = Number(new URL(request.url).searchParams.get("after") ?? "0");
		const oldest = Array.from(this.state.storage.sql.exec<{ version: number }>("SELECT MIN(version) AS version FROM replay_events"))[0]?.version;
		if (!Number.isSafeInteger(after) || (oldest !== undefined && after < oldest - 1)) return Response.json({ kind: "snapshot", ...this.snapshot(game, principal, this.currentDeliverySequence()) });
		const events = Array.from(this.state.storage.sql.exec<{ event_json: string }>("SELECT event_json FROM replay_events WHERE version > ? ORDER BY version", after)).map((row) => this.redactReplayEvent(JSON.parse(row.event_json), principal));
		return Response.json({ kind: "events", version: game.version, events });
	}

	private async apply(command: CommandEnvelope, principal: Principal): Promise<ServerMessage> {
		const game = this.load();
		if (!game || command.v !== PROTOCOL_VERSION || !command.id || command.id.trim().length === 0 || !command.type) return this.error("BAD_COMMAND", "Malformed command", command.id);
		const known = Array.from(this.state.storage.sql.exec<{ response_json: string }>("SELECT response_json FROM commands WHERE id = ?", command.id))[0];
		if (known) return JSON.parse(known.response_json) as ServerMessage;
		if (command.expectedVersion !== game.version) return this.error("CONFLICT", "State changed; request a snapshot and retry", command.id);
		if (["prompt.reveal", "phase.advance", "prompt.open"].includes(command.type) && this.hasPendingFrozenAdmissions(game)) return this.error("CONFLICT", "Audience totals are still draining", command.id);
		// Lifecycle is enforced here rather than relying on individual reducers.
		// That also protects the direct SQLite buzzer claim from mutating a room
		// after a host pauses or completes it.
		if (game.status === "complete") return this.rejectLifecycle(command, "Room is complete");
		if (game.status === "paused" && command.type !== "room.resume") return this.rejectLifecycle(command, "Room is paused");

		try {
			let next!: GameState;
			let outgoing!: ServerMessage;
			this.state.storage.transactionSync(() => {
				let event = command.type;
				let payload: unknown = command.payload;
				if (command.type === "buzzer.press" && game.gameKey !== "race-condition") {
					if (!game.activePrompt || !["player", "host", "producer"].includes(principal.role)) throw new Error("FORBIDDEN");
					const claimed = Array.from(this.state.storage.sql.exec<{ principal_id: string }>("INSERT OR IGNORE INTO buzzers (prompt_id, principal_id, at) VALUES (?, ?, ?) RETURNING principal_id", game.activePrompt.id, principal.id, new Date().toISOString()));
					if (claimed.length !== 1) throw new Error("CONFLICT");
					next = structuredClone(game);
					next.players[principal.id] = { displayName: principal.displayName ?? principal.id, teamId: principal.teamId };
					next.buzzer = { principalId: principal.id, at: new Date().toISOString() };
					next.buzzerWinner = principal.displayName ?? principal.id;
					next.version += 1;
					payload = { principalId: principal.id };
				} else {
					const result = applyCommand(game, command, principal, Date.now());
					next = result.state;
					event = result.event;
					payload = result.payload;
				}
				this.save(next);
				outgoing = { v: PROTOCOL_VERSION, type: "event", version: next.version, event, payload, commandId: command.id };
				this.state.storage.sql.exec("INSERT INTO commands (id, response_json) VALUES (?, ?)", command.id, JSON.stringify(outgoing));
				this.recordReplay(outgoing);
				this.enqueue(event, { commandId: command.id, principalId: principal.id, payload, version: next.version });
				if (next.status === "complete") this.enqueue("result.completed", { roomId: next.roomId, gameKey: next.gameKey, version: next.version, teams: Object.values(next.teams).map(({ id, score }) => ({ id, score })) });
				this.markPublicationIntent();
			});
			if (next.status === "complete" && this.consumeTestControl("terminal-delivery")) {
				// Completion and result intent are already durable. Simulate eviction
				// before external D1/fanout work; alarm resumes the real outbox path.
				return outgoing;
			}
			await this.deliverOutbox();
			await this.publishCurrent();
			if (next.status === "complete") await this.projectCompletion();
			return outgoing;
		} catch (error) {
			const code = error instanceof Error && error.message === "FORBIDDEN" ? "FORBIDDEN" : error instanceof Error && error.message === "CONFLICT" ? "CONFLICT" : error instanceof Error && error.message === "DEADLINE_EXPIRED" ? "DEADLINE_EXPIRED" : "BAD_COMMAND";
			const response = this.error(code, code === "CONFLICT" ? "Buzzer is already claimed" : code === "DEADLINE_EXPIRED" ? "The answer deadline has passed" : "Command rejected", command.id);
			this.state.storage.sql.exec("INSERT OR REPLACE INTO commands (id, response_json) VALUES (?, ?)", command.id, JSON.stringify(response));
			return response;
		}
	}

	private async flushAudience(request: Request): Promise<Response> {
		const principal = this.principal(request);
		if (!principal || principal.role !== "producer") return new Response("Forbidden", { status: 403 });
		const body = await request.json<{ totals?: Record<string, number>; reactions?: Record<string, number>; mode?: "vote" | "reaction"; shardId: string; promptId: string; commandIds?: string[]; admissionVersion?: number }>();
		if (!validAudienceTotals(body.totals) || !validAudienceTotals(body.reactions) || (body.commandIds?.length ?? 0) > 100) return Response.json({ error: { code: "BAD_AGGREGATE" } }, { status: 400 });
		await this.scheduleRecovery();
		const game = this.load();
		if (!game) return new Response("Not initialized", { status: 409 });
		const freeze = game.private.audienceFreeze;
		const admittedBeforeFreeze = body.mode === "vote" && game.audience.frozen && freeze?.promptId === body.promptId && Number.isInteger(body.admissionVersion) && body.admissionVersion! <= freeze.admissionVersion;
		if (game.audience.frozen && !admittedBeforeFreeze) return Response.json({ error: { code: "DISTRIBUTION_FROZEN" } }, { status: 409 });
		if (body.mode !== "reaction" && game.activePrompt && body.promptId !== game.activePrompt.id) return Response.json({ error: { code: "STALE_PROMPT" } }, { status: 409 });
		const next = structuredClone(game);
		if (body.mode === "reaction") {
			next.private.audienceReactionShards ??= {};
			next.private.audienceReactionShards[body.shardId] = body.reactions ?? {};
			next.audience.reactions = {};
			for (const shardReactions of Object.values(next.private.audienceReactionShards)) for (const [reaction, total] of Object.entries(shardReactions)) next.audience.reactions[reaction] = (next.audience.reactions[reaction] ?? 0) + total;
		}
		else {
			next.private.audienceShards ??= {};
			next.private.audienceShards[body.shardId] = body.totals ?? {};
			next.audience.totals = {};
			for (const shardTotals of Object.values(next.private.audienceShards)) for (const [choice, total] of Object.entries(shardTotals)) next.audience.totals[choice] = (next.audience.totals[choice] ?? 0) + total;
			// Public distributions preserve only what participants submitted. Official
			// answer/alias matches stay private until the game reveal, preventing the
			// aggregate stream from becoming a correctness oracle.
			next.audienceDistribution = structuredClone(next.audience.totals);
			next.private.audienceCanonicalShards ??= {};
			const canonical = { ...(next.private.audienceCanonicalShards[body.shardId] ?? {}) };
			for (const commandId of body.commandIds ?? []) {
				const admission = Array.from(this.state.storage.sql.exec<{ canonical_choice: string | null }>("SELECT canonical_choice FROM audience_admission_intents WHERE admission_key = ? AND prompt_id = ? AND shard_id = ? AND committed = 0", `${body.shardId}:${commandId}`, body.promptId, body.shardId))[0];
				if (admission?.canonical_choice) canonical[admission.canonical_choice] = (canonical[admission.canonical_choice] ?? 0) + 1;
			}
			next.private.audienceCanonicalShards[body.shardId] = canonical;
			next.private.audienceCanonicalDistribution = {};
			for (const shardTotals of Object.values(next.private.audienceCanonicalShards)) for (const [choice, total] of Object.entries(shardTotals)) next.private.audienceCanonicalDistribution[choice] = (next.private.audienceCanonicalDistribution[choice] ?? 0) + total;
			if (next.gameKey === "principal-engineer" && next.principalEngineer?.askAudienceActive) next.principalEngineer.audienceAdvice = structuredClone(next.audience.totals);
		}
		next.audience.lastFlushedAt = new Date().toISOString();
		// Audience projections are eventually batched and must not invalidate a
		// host/contestant command envelope captured from the prior snapshot.
		// They fan out as snapshots but deliberately retain command version.
		const aggregate = { promptId: body.promptId, shardId: body.shardId, commandIds: body.commandIds ?? [], totals: next.audience.totals, reactions: next.audience.reactions };
		const event: EventMessage = { v: PROTOCOL_VERSION, type: "event", version: next.version, event: "audience.aggregate", payload: aggregate };
		this.state.storage.transactionSync(() => {
			this.save(next);
			if (body.mode !== "reaction") {
				for (const commandId of body.commandIds ?? []) this.state.storage.sql.exec("UPDATE audience_admission_intents SET committed = 1 WHERE admission_key = ? AND prompt_id = ? AND shard_id = ?", `${body.shardId}:${commandId}`, body.promptId, body.shardId);
			}
			this.enqueue("audience.aggregate", { version: next.version, ...aggregate });
			this.markPublicationIntent();
		});
		// Replay is keyed by command version; projection events share that version
		// and would overwrite a gameplay replay event, so reconnect uses snapshot.
		await this.deliverOutbox();
		event.deliverySequence = await this.publishCurrent();
		return Response.json(event);
	}

	private enqueue(kind: string, payload: unknown): void {
		this.state.storage.sql.exec("INSERT INTO outbox (kind, payload_json, occurred_at) VALUES (?, ?, ?)", kind, JSON.stringify(payload), new Date().toISOString());
	}

	private recordReplay(event: ServerMessage): void {
		if (event.type !== "event") return;
		this.state.storage.sql.exec("INSERT OR REPLACE INTO replay_events (version, event_json) VALUES (?, ?)", event.version, JSON.stringify(event));
		this.state.storage.sql.exec("DELETE FROM replay_events WHERE version <= ?", event.version - 1_000);
	}

	private async flushOutbox(): Promise<void> {
		const game = this.load();
		if (!game) return;
		const failure = Array.from(this.state.storage.sql.exec<{ value: number }>("SELECT value FROM test_controls WHERE key = 'outbox'"))[0]?.value ?? 0;
		if (failure > 0) {
			this.state.storage.sql.exec("UPDATE test_controls SET value = value - 1 WHERE key = 'outbox'");
			throw new Error("test requested outbox delivery failure");
		}
		const rows = Array.from(this.state.storage.sql.exec<{ sequence: number; kind: string; payload_json: string; occurred_at: string }>("SELECT sequence, kind, payload_json, occurred_at FROM outbox ORDER BY sequence LIMIT 100"));
		if (!rows.length) return;
		await this.env.DB.batch(rows.map((row) => this.env.DB.prepare(
			"INSERT OR IGNORE INTO arcade_room_outbox (id, room_id, sequence, kind, payload_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?)",
		).bind(`${game.roomId}:${row.sequence}`, game.roomId, row.sequence, row.kind, row.payload_json, row.occurred_at)));
		this.state.storage.sql.exec("DELETE FROM outbox WHERE sequence <= ?", rows.at(-1)?.sequence ?? 0);
		const remaining = Array.from(this.state.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM outbox"))[0]?.count ?? 0;
		if (remaining > 0) await this.state.storage.setAlarm(Date.now() + 10);
	}

	private async deliverOutbox(): Promise<void> {
		try {
			await this.flushOutbox();
		} catch (error) {
			// D1 is a projection target; never roll back a committed live command because it is unavailable.
			console.error("arcade room outbox delivery failed", error);
			await this.state.storage.setAlarm(Date.now() + 1_000);
		}
	}

	/**
	 * Snapshot fanout is a separate monotonic stream from optimistic gameplay
	 * versions. Audience aggregates and presence deliberately keep game.version
	 * stable, so deliverySequence prevents a later D1 await from reviving an
	 * earlier public state in a browser or shard.
	 */
	private async publishCurrent(): Promise<number | undefined> {
		const game = this.load();
		if (!game) return undefined;
		const deliverySequence = this.state.storage.transactionSync(() => {
			const sequence = this.nextDeliverySequence();
			const audienceSnapshot = JSON.stringify(this.snapshot(game, { id: "audience-shard", role: "audience" }, sequence));
			for (const { shard_id: shardId } of this.state.storage.sql.exec<{ shard_id: string }>("SELECT shard_id FROM audience_shards")) {
				this.state.storage.sql.exec("INSERT INTO fanout_queue (shard_id, delivery_sequence, snapshot_json) VALUES (?, ?, ?) ON CONFLICT(shard_id) DO UPDATE SET delivery_sequence = excluded.delivery_sequence, snapshot_json = excluded.snapshot_json", shardId, sequence, audienceSnapshot);
			}
			return sequence;
		});
		for (const socket of this.state.getWebSockets()) {
			const principal = (socket.deserializeAttachment() as Attachment | null)?.principal;
			if (principal) socket.send(JSON.stringify(this.snapshot(game, principal, deliverySequence)));
		}
		this.state.storage.sql.exec("DELETE FROM publication_intent WHERE id = 1");
		await this.deliverAudienceShardFanout();
		return deliverySequence;
	}

	private markPublicationIntent(): void {
		this.state.storage.sql.exec("INSERT OR REPLACE INTO publication_intent (id, requested_at) VALUES (1, ?)", new Date().toISOString());
	}

	private hasPublicationIntent(): boolean {
		return Array.from(this.state.storage.sql.exec<{ id: number }>("SELECT id FROM publication_intent WHERE id = 1")).length === 1;
	}

	private nextDeliverySequence(): number {
		const current = this.currentDeliverySequence();
		const next = current + 1;
		this.state.storage.sql.exec("INSERT OR REPLACE INTO delivery_state (id, sequence) VALUES (1, ?)", next);
		return next;
	}

	private currentDeliverySequence(): number {
		return Array.from(this.state.storage.sql.exec<{ sequence: number }>("SELECT sequence FROM delivery_state WHERE id = 1"))[0]?.sequence ?? 0;
	}

	private async deliverAudienceShardFanout(): Promise<void> {
		const rows = Array.from(this.state.storage.sql.exec<{ shard_id: string; delivery_sequence: number; snapshot_json: string }>("SELECT shard_id, delivery_sequence, snapshot_json FROM fanout_queue ORDER BY delivery_sequence LIMIT 100"));
		let retry = false;
		for (const row of rows) {
			try {
				const game = this.load();
				if (!game) return;
				const response = await this.env.AUDIENCE_SHARD.get(this.env.AUDIENCE_SHARD.idFromName(`${game.roomId}:audience:${row.shard_id}`)).fetch("https://audience-shard.internal/_internal/public-update", {
					method: "POST",
					headers: { "content-type": "application/json", "x-arcade-principal": JSON.stringify({ id: "game-room", role: "producer" }) },
					body: row.snapshot_json,
				});
				if (!response.ok) { retry = true; continue; }
				// Do not delete a newer upsert while this fetch was in flight.
				this.state.storage.sql.exec("DELETE FROM fanout_queue WHERE shard_id = ? AND delivery_sequence = ?", row.shard_id, row.delivery_sequence);
			} catch (error) {
				console.error("arcade audience snapshot fanout failed", error);
				retry = true;
			}
		}
		const pending = Array.from(this.state.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM fanout_queue"))[0]?.count ?? 0;
		if (retry || pending > 0) await this.state.storage.setAlarm(Date.now() + (retry ? 1_000 : 10));
	}

	private websocketResponse(client: WebSocket, request: Request): Response {
		const offered = request.headers.get("Sec-WebSocket-Protocol")?.split(",").map((value) => value.trim()).find((value) => value.startsWith("arcade-ticket."));
		return new Response(null, { status: 101, webSocket: client, headers: offered ? { "Sec-WebSocket-Protocol": offered } : undefined });
	}

	private redactReplayEvent(event: ServerMessage, principal: Principal): ServerMessage {
		if (principal.role === "host" || principal.role === "producer" || principal.role === "moderator") return event;
		if (event.type !== "event") return event;
		const scrub = (value: unknown): unknown => {
			if (Array.isArray(value)) return value.map(scrub);
			if (!value || typeof value !== "object") return value;
			return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !["answer", "correctAnswer", "e2ePrivateMarker", "hostNotes", "notes"].includes(key)).map(([key, nested]) => [key, scrub(nested)]));
		};
		return { ...event, payload: scrub(event.payload) };
	}

	private async projectCompletion(): Promise<void> {
		try {
			await this.deliverOutbox();
			await this.consumeProjectedOutbox();
		} catch (error) { console.error("arcade result projection failed", error); }
	}

	private async consumeProjectedOutbox(): Promise<void> {
		try {
			const failure = Array.from(this.state.storage.sql.exec<{ value: number }>("SELECT value FROM test_controls WHERE key = 'projection'"))[0]?.value ?? 0;
			if (failure > 0) {
				this.state.storage.sql.exec("UPDATE test_controls SET value = value - 1 WHERE key = 'projection'");
				throw new Error("test requested result projection failure");
			}
			const projected = await new ResultProjector(this.env).consumeOutbox(100);
			if (projected >= 100) await this.state.storage.setAlarm(Date.now() + 10);
		} catch (error) {
			console.error("arcade result outbox retry failed", error);
			await this.state.storage.setAlarm(Date.now() + 1_000);
		}
	}

	private async recordPresence(roomId: string, principal: Principal, delta: 1 | -1): Promise<void> {
		try {
			const now = new Date().toISOString();
			await this.env.DB.prepare("INSERT INTO arcade_room_presence (room_id, principal_id, role, connections, connected_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(room_id, principal_id) DO UPDATE SET role = excluded.role, connections = MAX(0, arcade_room_presence.connections + ?), connected_at = CASE WHEN arcade_room_presence.connections + ? > 0 THEN excluded.connected_at ELSE arcade_room_presence.connected_at END, last_seen_at = excluded.last_seen_at")
				.bind(roomId, principal.id, principal.role, Math.max(delta, 0), delta > 0 ? now : null, now, delta, delta).run();
		} catch (error) { console.error("arcade presence projection failed", error); }
	}

	private setTestFailure(request: Request, key: string): Response {
		if (this.env.ENVIRONMENT !== "test" || !this.env.E2E_SEED_SECRET || request.headers.get("x-arcade-test-secret") !== this.env.E2E_SEED_SECRET) return new Response("Not found", { status: 404 });
		this.state.storage.sql.exec("INSERT INTO test_controls (key, value) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET value = value + 1", key);
		return Response.json({ ok: true, key });
	}

	private consumeTestControl(key: string): boolean {
		const value = Array.from(this.state.storage.sql.exec<{ value: number }>("SELECT value FROM test_controls WHERE key = ?", key))[0]?.value ?? 0;
		if (value <= 0) return false;
		this.state.storage.sql.exec("UPDATE test_controls SET value = value - 1 WHERE key = ?", key);
		return true;
	}

	private async waitAtTestAdmissionBarrier(phase: "before" | "after"): Promise<void> {
		if (this.env.ENVIRONMENT !== "test" || !this.consumeTestControl(`audience-admission-hold-${phase}`)) return;
		await new Promise<void>((resolve) => this.testAdmissionBarrierWaiters[phase].push(resolve));
	}

	private testAdmissionBarriers(request: Request): Response {
		if (!this.validTestRequest(request)) return new Response("Not found", { status: 404 });
		return Response.json({ before: this.testAdmissionBarrierWaiters.before.length, after: this.testAdmissionBarrierWaiters.after.length });
	}

	private releaseTestAdmissionBarrier(request: Request, phase: string | null): Response {
		if (!this.validTestRequest(request) || (phase !== "before" && phase !== "after")) return new Response("Not found", { status: 404 });
		const waiters = this.testAdmissionBarrierWaiters[phase].splice(0);
		for (const release of waiters) release();
		return Response.json({ released: waiters.length, phase });
	}

	private validTestRequest(request: Request): boolean {
		return this.env.ENVIRONMENT === "test" && Boolean(this.env.E2E_SEED_SECRET) && request.headers.get("x-arcade-test-secret") === this.env.E2E_SEED_SECRET;
	}

	private send(socket: WebSocket, message: ServerMessage): void { socket.send(JSON.stringify(message)); }

	private rejectLifecycle(command: CommandEnvelope, message: string): ServerMessage {
		const response = this.error("FORBIDDEN", message, command.id);
		this.state.storage.sql.exec("INSERT INTO commands (id, response_json) VALUES (?, ?)", command.id, JSON.stringify(response));
		return response;
	}

	private hasPendingFrozenAdmissions(game: GameState): boolean {
		const freeze = game.private.audienceFreeze;
		if (!freeze?.promptId) return false;
		const row = Array.from(this.state.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM audience_admission_intents WHERE prompt_id = ? AND admission_version <= ? AND committed = 0", freeze.promptId, freeze.admissionVersion))[0];
		return (row?.count ?? 0) > 0;
	}

	private allowFrame(socket: WebSocket, attachment: Attachment): boolean {
		const now = Date.now();
		const rate = !attachment.rate || now - attachment.rate.startedAt >= 1_000 ? { startedAt: now, frames: 1 } : { ...attachment.rate, frames: attachment.rate.frames + 1 };
		attachment.rate = rate;
		socket.serializeAttachment(attachment);
		return rate.frames <= 30;
	}

	private error(code: "BAD_COMMAND" | "CONFLICT" | "FORBIDDEN" | "DUPLICATE" | "RATE_LIMITED" | "DEADLINE_EXPIRED", message: string, commandId?: string): ServerMessage {
		return { v: PROTOCOL_VERSION, type: "error", code, message, commandId };
	}
}

void internal;
