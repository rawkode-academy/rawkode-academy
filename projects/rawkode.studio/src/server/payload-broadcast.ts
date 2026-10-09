import type { StudioEnv } from "../env";
import { resolveMachineSecret, signMachineRequest } from "./machine-auth";
import { getStudioSession, type StudioSessionRecord } from "./studio";

// Broadcast times for Payload's editorial times (workstream F). Studio never
// waits on Payload: a live transition writes one outbox row in
// studio_broadcast_events, a fire-and-forget call (waitUntil) sends it, and the
// 5 minute cron retries anything still pending. Only production sessions linked
// to a content video (the Payload legacyId) are reported.
//
// Transport and auth match the review handoff: the PAYLOAD service binding and
// the shared HMAC scheme in ./machine-auth.ts, signed over the route constant
// below. The outbox row id is both the Payload commandId and the signed
// Idempotency-Key, so a retry can never record a second effect.
export const PAYLOAD_BROADCAST_PATH = "/api/editorial/broadcast";
export const broadcastClaimLeaseSeconds = 120;
// Payload refuses a broadcast-started older than 24 hours, so every retry must land
// inside that window: hourly after the first hour, the last attempt at about 16h.
export const broadcastBackoffSeconds = [60, 300, 900, 3600] as const;
export const maxBroadcastAttempts = 20;
// Sessions the cron backfills when their outbox write was lost, kept inside
// Payload's 24 hour acceptance window.
export const broadcastBackfillSeconds = 23 * 3600;
export const defaultBroadcastTimeoutMs = 10_000;

export type BroadcastAction = "broadcast-started" | "broadcast-ended";
export type BroadcastEventRow = {
	id: string;
	session_id: string;
	action: BroadcastAction;
	content_video_id: string;
	occurred_at: string;
	state: "pending" | "sent" | "rejected";
	attempts: number;
	next_attempt_at: number | null;
	last_error: string | null;
};
export type BroadcastResult = { status: "not-configured" | "busy" | "sent" | "rejected" | "retrying" };

function broadcastConfig(env: StudioEnv) {
	if (!env.STUDIO_DB || !env.PAYLOAD || !env.PAYLOAD_HANDOFF_URL || !env.STUDIO_MACHINE_SECRET) {
		return null;
	}
	return {
		db: env.STUDIO_DB,
		payload: env.PAYLOAD,
		// Same Payload Worker as the handoff; only the route differs.
		url: new URL(PAYLOAD_BROADCAST_PATH, env.PAYLOAD_HANDOFF_URL).toString(),
		secret: env.STUDIO_MACHINE_SECRET,
	};
}
type BroadcastConfig = NonNullable<ReturnType<typeof broadcastConfig>>;

const nowSeconds = () => Math.floor(Date.now() / 1000);
const errorMessage = (error: unknown) =>
	(error instanceof Error ? error.message : String(error)).slice(0, 2000);

// Queues one broadcast event for the session's current stream times. Returns the
// event id, or null when nothing is reported. The (session, action, time) key makes
// a repeated call a no-op; an end is queued only after its start was.
export async function queueBroadcastEvent(
	env: StudioEnv,
	session: Pick<StudioSessionRecord, "id" | "contentVideoId" | "streamEnvironment" | "streamStartedAt" | "streamEndedAt">,
	action: BroadcastAction,
): Promise<string | null> {
	const config = broadcastConfig(env);
	if (!config || session.streamEnvironment !== "prod" || !session.contentVideoId) return null;
	const seconds = action === "broadcast-started" ? session.streamStartedAt : session.streamEndedAt;
	if (!seconds) return null;
	const at = new Date(seconds * 1000).toISOString();
	const values = [crypto.randomUUID(), session.id, action, session.contentVideoId, at];
	await config.db
		.prepare(
			action === "broadcast-started"
				? `INSERT OR IGNORE INTO studio_broadcast_events (id, session_id, action, content_video_id, occurred_at)
				   VALUES (?, ?, ?, ?, ?)`
				: `INSERT OR IGNORE INTO studio_broadcast_events (id, session_id, action, content_video_id, occurred_at)
				   SELECT ?, ?, ?, ?, ?
				    WHERE EXISTS (SELECT 1 FROM studio_broadcast_events WHERE session_id = ? AND action = 'broadcast-started')`,
		)
		.bind(...values, ...(action === "broadcast-ended" ? [session.id] : []))
		.run();
	const row = await config.db
		.prepare(
			`SELECT id FROM studio_broadcast_events WHERE session_id = ? AND action = ? AND occurred_at = ?`,
		)
		.bind(session.id, action, at)
		.first<{ id: string }>();
	return row?.id ?? null;
}

// Leases a due event. An event waits while an earlier one for the same session is
// still pending, so an end never reaches Payload before its start.
async function claim(db: D1Database, id: string, now: number) {
	return await db
		.prepare(
			`UPDATE studio_broadcast_events
			    SET next_attempt_at = ?, updated_at = unixepoch()
			  WHERE id = ?
			    AND state = 'pending'
			    AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
			    AND NOT EXISTS (
			      SELECT 1 FROM studio_broadcast_events AS earlier
			       WHERE earlier.session_id = studio_broadcast_events.session_id
			         AND earlier.state = 'pending'
			         AND earlier.rowid < studio_broadcast_events.rowid
			    )
			RETURNING *`,
		)
		.bind(now + broadcastClaimLeaseSeconds, id, now)
		.first<BroadcastEventRow>();
}

async function settle(
	db: D1Database,
	id: string,
	fields: { state?: BroadcastEventRow["state"]; attempts?: number; next_attempt_at: number | null; last_error: string | null },
) {
	const columns = Object.keys(fields) as (keyof typeof fields)[];
	await db
		.prepare(
			`UPDATE studio_broadcast_events
			    SET ${columns.map((column) => `${column} = ?`).join(", ")}, updated_at = unixepoch()
			  WHERE id = ?`,
		)
		.bind(...columns.map((column) => fields[column] ?? null), id)
		.run();
}

export function buildBroadcastBody(row: BroadcastEventRow) {
	return { action: row.action, legacyId: row.content_video_id, commandId: row.id, at: row.occurred_at };
}

async function callPayload(config: BroadcastConfig, row: BroadcastEventRow, timeoutMs: number) {
	const secret = await resolveMachineSecret(config.secret);
	if (!secret) throw new Error("STUDIO_MACHINE_SECRET is unavailable");
	const body = JSON.stringify(buildBroadcastBody(row));
	const headers = await signMachineRequest(secret, {
		method: "POST",
		path: PAYLOAD_BROADCAST_PATH,
		timestamp: nowSeconds(),
		idempotencyKey: row.id,
		body,
	});
	return await config.payload.fetch(
		new Request(config.url, {
			method: "POST",
			headers: { ...headers, "content-type": "application/json" },
			body,
			signal: AbortSignal.timeout(timeoutMs),
		}),
	);
}

// Sends one queued event. Safe from waitUntil and the cron at the same time:
// only the lease holder sends.
export async function sendBroadcastEvent(
	env: StudioEnv,
	id: string,
	options: { now?: number; timeoutMs?: number } = {},
): Promise<BroadcastResult> {
	const config = broadcastConfig(env);
	if (!config) return { status: "not-configured" };
	const now = options.now ?? nowSeconds();
	const row = await claim(config.db, id, now);
	if (!row) return { status: "busy" };
	const retry = async (error: string): Promise<BroadcastResult> => {
		const attempts = row.attempts + 1;
		if (attempts >= maxBroadcastAttempts) {
			await settle(config.db, row.id, { state: "rejected", attempts, next_attempt_at: null, last_error: `${error}; gave up after ${attempts} attempts` });
			return { status: "rejected" };
		}
		const delay = broadcastBackoffSeconds[Math.min(attempts - 1, broadcastBackoffSeconds.length - 1)];
		await settle(config.db, row.id, { attempts, next_attempt_at: now + delay, last_error: error });
		return { status: "retrying" };
	};
	let response: Response;
	try {
		response = await callPayload(config, row, options.timeoutMs ?? defaultBroadcastTimeoutMs);
	} catch (error) {
		return await retry(`Payload unreachable: ${errorMessage(error)}`);
	}
	if (response.ok) {
		await settle(config.db, row.id, { state: "sent", next_attempt_at: null, last_error: null });
		return { status: "sent" };
	}
	const error = `Payload ${response.status}: ${(await response.text().catch(() => "")).slice(0, 500)}`;
	// 404 is a video Payload has not imported yet; 401/403 a secret being rotated;
	// 5xx is transient (503 in previews, or a race with a staff edit that Payload
	// could not settle). 400 and 409 are semantic and final: staff correct the times
	// in Payload.
	if ([401, 403, 404, 408, 429].includes(response.status) || response.status >= 500) {
		return await retry(error);
	}
	await settle(config.db, row.id, { state: "rejected", attempts: row.attempts + 1, next_attempt_at: null, last_error: error });
	return { status: "rejected" };
}

// Called right after a stream transition is saved. Never throws: the live path
// must succeed even when the outbox write or Payload fails.
export async function recordStudioBroadcast(
	env: StudioEnv,
	sessionId: string,
	action: BroadcastAction,
	defer?: (promise: Promise<unknown>) => void,
): Promise<void> {
	try {
		const session = await getStudioSession(env, sessionId);
		if (!session) return;
		const id = await queueBroadcastEvent(env, session, action);
		if (!id) return;
		// Without defer, the 5 minute cron sends it.
		defer?.(
			sendBroadcastEvent(env, id).catch((error: unknown) => {
				console.error("studio_broadcast_send_failed", id, error);
			}),
		);
	} catch (error) {
		console.error("studio_broadcast_queue_failed", sessionId, action, error);
	}
}

// Queues the events of recent production sessions whose outbox write was lost (a
// transient D1 error on the live path). Each insert is keyed on the session's
// current times, so a session already reported is a no-op.
async function backfillBroadcastEvents(env: StudioEnv, config: BroadcastConfig, now: number, limit: number) {
	const iso = (column: string) => `strftime('%Y-%m-%dT%H:%M:%fZ', s.${column}, 'unixepoch')`;
	const missing = (action: BroadcastAction, column: string) =>
		`NOT EXISTS (SELECT 1 FROM studio_broadcast_events e WHERE e.session_id = s.id AND e.action = '${action}' AND e.occurred_at = ${iso(column)})`;
	const sessions = await config.db
		.prepare(
			`SELECT s.id, s.content_video_id AS contentVideoId, s.stream_environment AS streamEnvironment,
			        s.stream_started_at AS streamStartedAt, s.stream_ended_at AS streamEndedAt
			   FROM studio_sessions s
			  WHERE s.stream_environment = 'prod' AND s.content_video_id IS NOT NULL AND s.stream_started_at >= ?
			    AND (${missing("broadcast-started", "stream_started_at")}
			         OR (s.stream_ended_at IS NOT NULL AND ${missing("broadcast-ended", "stream_ended_at")}))
			  ORDER BY s.stream_started_at
			  LIMIT ?`,
		)
		.bind(now - broadcastBackfillSeconds, limit)
		.all<Parameters<typeof queueBroadcastEvent>[1]>();
	for (const session of sessions.results ?? []) {
		await queueBroadcastEvent(env, session, "broadcast-started");
		if (session.streamEndedAt) await queueBroadcastEvent(env, session, "broadcast-ended");
	}
}

export async function reconcileBroadcastEvents(
	env: StudioEnv,
	now = nowSeconds(),
	limit = 20,
	options: { timeoutMs?: number } = {},
): Promise<Array<{ id: string; result: BroadcastResult | { status: "error"; error: string } }>> {
	const config = broadcastConfig(env);
	if (!config) return [];
	try {
		await backfillBroadcastEvents(env, config, now, limit);
	} catch (error) {
		console.error("studio_broadcast_backfill_failed", error);
	}
	const due = await config.db
		.prepare(
			`SELECT id FROM studio_broadcast_events
			  WHERE state = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
			  ORDER BY rowid
			  LIMIT ?`,
		)
		.bind(now, limit)
		.all<{ id: string }>();
	const results: Array<{ id: string; result: BroadcastResult | { status: "error"; error: string } }> = [];
	for (const { id } of due.results ?? []) {
		try {
			results.push({ id, result: await sendBroadcastEvent(env, id, { ...options, now }) });
		} catch (error) {
			console.error("studio_broadcast_reconcile_failed", id, error);
			results.push({ id, result: { status: "error", error: errorMessage(error) } });
		}
	}
	return results;
}
