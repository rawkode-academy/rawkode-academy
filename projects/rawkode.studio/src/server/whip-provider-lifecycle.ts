import type { StudioEnv } from "../env";
import {
	createCloudflareStreamLiveInputBody,
	deleteCloudflareStreamLiveInput,
	getCloudflareStreamConfig,
} from "./cloudflare-stream";
import { cancelStudioStreamAttempt, getStudioStreamTakeoverLeaseId, type StudioSessionRecord } from "./studio";

type WhipAttemptState = "reserved" | "creating" | "issued" | "uncertain" | "revoking" | "retired";

interface WhipAttemptRow {
	attempt_id: string;
	create_body: string;
	idempotency_key: string;
	provider_account_id: string;
	provider_input_id: string | null;
	session_id: string;
	start_token: string;
	state: WhipAttemptState;
}

export type WhipProviderRevocation = "not-required" | "pending" | "revoked";

function requireDb(env: StudioEnv): D1Database {
	if (!env.STUDIO_DB) throw new Error("STUDIO_DB binding is required for WHIP provider lifecycle");
	return env.STUDIO_DB;
}

function changed(result: D1Result): boolean {
	return (result.meta?.changes ?? result.meta?.rows_written ?? 0) === 1;
}

export async function isProductionWhipReady(env: StudioEnv, accountId: string): Promise<boolean> {
	const row = await requireDb(env).prepare(
		`SELECT production_ready FROM studio_whip_provider_readiness
		  WHERE id = 1 AND provider_account_id = ? AND production_ready = 1
		    AND NOT EXISTS (SELECT 1 FROM studio_whip_legacy_owners WHERE state = 'pending')`,
	).bind(accountId).first<{ production_ready: number }>();
	return row?.production_ready === 1;
}

export async function reserveWhipProviderAttempt(
	env: StudioEnv,
	input: { accountId: string; session: StudioSessionRecord; startToken: string },
): Promise<{ attemptId: string; body: string; idempotencyKey: string } | null> {
	const db = requireDb(env);
	const attemptId = crypto.randomUUID();
	const idempotencyKey = `studio-whip-${crypto.randomUUID()}`;
	const [startingId, liveId] = await Promise.all([
		getStudioStreamTakeoverLeaseId(input.session.id, { status: "starting", startToken: input.startToken }),
		getStudioStreamTakeoverLeaseId(input.session.id, { status: "live", startToken: input.startToken }),
	]);
	if (!startingId || !liveId) throw new Error("A WHIP publisher token is required");
	const body = createCloudflareStreamLiveInputBody({
		contentVideoSlug: input.session.contentVideoSlug,
		name: input.session.title,
		sessionId: input.session.id,
		streamEnvironment: input.session.streamEnvironment,
	});
	const result = await db.prepare(
		`INSERT OR IGNORE INTO studio_whip_provider_attempts (
		   attempt_id, session_id, start_token, stream_environment, provider_account_id,
		   idempotency_key, create_body, takeover_starting_id, takeover_live_id, state
		 ) SELECT ?, id, ?, stream_environment, ?, ?, ?, ?, ?, 'reserved'
		     FROM studio_sessions
		    WHERE id = ? AND status <> 'complete' AND stream_status = 'starting'
		      AND stream_start_token = ? AND stream_heartbeat_at >= unixepoch() - 120
		      AND (stream_environment <> 'prod' OR EXISTS (
		        SELECT 1 FROM studio_whip_provider_readiness
		         WHERE id = 1 AND production_ready = 1 AND provider_account_id = ?
		           AND NOT EXISTS (SELECT 1 FROM studio_whip_legacy_owners WHERE state = 'pending')
		      ))`,
	).bind(attemptId, input.startToken, input.accountId, idempotencyKey, body, startingId, liveId,
		input.session.id, input.startToken, input.accountId).run();
	return changed(result) ? { attemptId, body, idempotencyKey } : null;
}

export async function markWhipCreateDispatched(env: StudioEnv, attemptId: string): Promise<boolean> {
	const result = await requireDb(env).prepare(
		`UPDATE studio_whip_provider_attempts
		    SET state = 'creating', dispatched_at = unixepoch(), updated_at = unixepoch()
		  WHERE attempt_id = ? AND state = 'reserved'
		    AND EXISTS (SELECT 1 FROM studio_sessions AS s
		      WHERE s.id = studio_whip_provider_attempts.session_id
		        AND s.status <> 'complete' AND s.stream_status = 'starting'
		        AND s.stream_start_token = studio_whip_provider_attempts.start_token
		        AND s.stream_heartbeat_at >= unixepoch() - 120)
		    AND (stream_environment <> 'prod' OR EXISTS (
		      SELECT 1 FROM studio_whip_provider_readiness
		       WHERE id = 1 AND production_ready = 1
		         AND provider_account_id = studio_whip_provider_attempts.provider_account_id
		         AND NOT EXISTS (SELECT 1 FROM studio_whip_legacy_owners WHERE state = 'pending')
		    ))`,
	).bind(attemptId).run();
	return changed(result);
}

export async function recordWhipProviderInput(
	env: StudioEnv,
	attemptId: string,
	providerInputId: string,
): Promise<boolean> {
	const db = requireDb(env);
	const result = await db.prepare(
		`UPDATE studio_whip_provider_attempts
		    SET provider_input_id = ?,
		        state = CASE WHEN state = 'creating' AND EXISTS (
		          SELECT 1 FROM studio_sessions AS s
		           WHERE s.id = studio_whip_provider_attempts.session_id
		             AND s.status <> 'complete' AND s.stream_status = 'starting'
		             AND s.stream_start_token = studio_whip_provider_attempts.start_token
		             AND s.stream_heartbeat_at >= unixepoch() - 120
		        ) AND (stream_environment <> 'prod' OR EXISTS (
		          SELECT 1 FROM studio_whip_provider_readiness
		           WHERE id = 1 AND production_ready = 1
		             AND provider_account_id = studio_whip_provider_attempts.provider_account_id
		             AND NOT EXISTS (SELECT 1 FROM studio_whip_legacy_owners WHERE state = 'pending')
		        )) THEN 'issued' ELSE 'revoking' END,
		        updated_at = unixepoch()
		  WHERE attempt_id = ? AND state IN ('creating', 'uncertain')
		    AND (provider_input_id IS NULL OR provider_input_id = ?)`,
	).bind(providerInputId, attemptId, providerInputId).run();
	if (!changed(result)) return false;
	const row = await db.prepare(
		"SELECT state FROM studio_whip_provider_attempts WHERE attempt_id = ?",
	).bind(attemptId).first<Pick<WhipAttemptRow, "state">>();
	return row?.state === "issued";
}

export async function markWhipCreateUncertain(env: StudioEnv, attemptId: string): Promise<void> {
	await requireDb(env).prepare(
		`UPDATE studio_whip_provider_attempts SET state = 'uncertain', updated_at = unixepoch()
		  WHERE attempt_id = ? AND state = 'creating' AND provider_input_id IS NULL`,
	).bind(attemptId).run();
}

export async function requestWhipProviderRetirement(
	env: StudioEnv,
	sessionId: string,
	startToken?: string,
): Promise<void> {
	const tokenFilter = startToken ? " AND start_token = ?" : "";
	await requireDb(env).prepare(
		`UPDATE studio_whip_provider_attempts
		    SET state = CASE state WHEN 'reserved' THEN 'retired'
		      WHEN 'creating' THEN 'uncertain' WHEN 'issued' THEN 'revoking' ELSE state END,
		        updated_at = unixepoch()
		  WHERE session_id = ?${tokenFilter} AND state IN ('reserved', 'creating', 'issued')`,
	).bind(...(startToken ? [sessionId, startToken] : [sessionId])).run();
}

export async function tryRetireWhipProviderAttempt(env: StudioEnv, sessionId: string, startToken: string): Promise<void> {
	const attempt = await requireDb(env).prepare(
		`SELECT attempt_id, session_id, start_token, state, provider_account_id, provider_input_id
		   FROM studio_whip_provider_attempts
		  WHERE session_id = ? AND start_token = ? AND state = 'revoking' AND provider_input_id IS NOT NULL`,
	).bind(sessionId, startToken).first<WhipAttemptRow>();
	if (attempt) await retireKnownWhipProviderInput(env, attempt, 3_000);
}

async function retireKnownWhipProviderInput(
	env: StudioEnv,
	attempt: WhipAttemptRow,
	timeoutMs: number,
): Promise<"deleted" | "already-retired" | "pending"> {
	const db = requireDb(env);
	if (!attempt.provider_input_id) return "pending";
	try {
		const config = await getCloudflareStreamConfig(env);
		if (!config || config.accountId !== attempt.provider_account_id) throw new Error("WHIP provider account is unavailable");
		await deleteCloudflareStreamLiveInput(config, attempt.provider_input_id, timeoutMs);
		const retired = await db.prepare(
			`UPDATE studio_whip_provider_attempts SET state = 'retired', updated_at = unixepoch()
			  WHERE attempt_id = ? AND state = 'revoking' AND provider_account_id = ? AND provider_input_id = ?`,
		).bind(attempt.attempt_id, attempt.provider_account_id, attempt.provider_input_id).run();
		if (changed(retired)) return "deleted";
		const current = await db.prepare("SELECT state FROM studio_whip_provider_attempts WHERE attempt_id = ?")
			.bind(attempt.attempt_id).first<Pick<WhipAttemptRow, "state">>();
		return current?.state === "retired" ? "already-retired" : "pending";
	} catch {
		// An ambiguous deletion or lost D1 acknowledgement retains the barrier.
		await db.prepare(
			`UPDATE studio_whip_provider_attempts SET updated_at = unixepoch()
			  WHERE attempt_id = ? AND state = 'revoking' AND provider_input_id = ?`,
		).bind(attempt.attempt_id, attempt.provider_input_id).run().catch(() => undefined);
		return "pending";
	}
}

export async function getWhipProviderRevocation(
	env: StudioEnv,
	sessionId: string,
	startToken: string,
): Promise<WhipProviderRevocation> {
	const row = await requireDb(env).prepare(
		`SELECT state FROM studio_whip_provider_attempts WHERE session_id = ? AND start_token = ?`,
	).bind(sessionId, startToken).first<Pick<WhipAttemptRow, "state">>();
	if (!row) {
		const legacy = await requireDb(env).prepare(
			"SELECT state FROM studio_whip_legacy_owners WHERE session_id = ? AND start_token = ?",
		).bind(sessionId, startToken).first<{ state: "pending" | "retired" }>();
		return legacy ? legacy.state === "retired" ? "revoked" : "pending" : "not-required";
	}
	return row.state === "retired" ? "revoked" : "pending";
}

export async function getWhipTakeoverState(
	env: StudioEnv,
	sessionId: string,
	observedLease: string,
): Promise<"active" | "pending" | "revoked" | "unknown"> {
	const row = await requireDb(env).prepare(
		`SELECT p.state,
		        (s.status <> 'complete' AND s.stream_start_token = p.start_token AND (
		          (s.stream_status = 'starting' AND s.stream_heartbeat_at >= unixepoch() - 120)
		          OR (s.stream_status = 'live' AND s.stream_heartbeat_at >= unixepoch() - 20)
		        )) AS active_lease
		   FROM studio_whip_provider_attempts AS p
		   LEFT JOIN studio_sessions AS s ON s.id = p.session_id
		  WHERE p.session_id = ? AND (p.takeover_starting_id = ? OR p.takeover_live_id = ?)
		  LIMIT 1`,
	).bind(sessionId, observedLease, observedLease).first<{ state: WhipAttemptState; active_lease: number | null }>();
	if (!row) {
		// Pre-cutover tokens have no provider-attempt row. Derive both possible
		// observation IDs from the exact token captured by the migration so a
		// pending legacy takeover can be checked after its lease is cleared.
		const { results = [] } = await requireDb(env).prepare(
			`SELECT p.start_token, p.state,
			        (s.status <> 'complete' AND s.stream_start_token = p.start_token AND (
			          (s.stream_status = 'starting' AND s.stream_heartbeat_at >= unixepoch() - 120)
			          OR (s.stream_status = 'live' AND s.stream_heartbeat_at >= unixepoch() - 20)
			        )) AS active_lease
			   FROM studio_whip_legacy_owners AS p
			   LEFT JOIN studio_sessions AS s ON s.id = p.session_id
			  WHERE p.session_id = ?`,
		).bind(sessionId).all<{ start_token: string; state: "pending" | "retired"; active_lease: number | null }>();
		for (const legacy of results) {
			if (!(await matchesTakeoverObservation(sessionId, legacy.start_token, observedLease))) continue;
			if (legacy.state === "retired") return "revoked";
			return legacy.active_lease === 1 ? "active" : "pending";
		}
		// Cancellation and lease ending are atomic. Check the tombstone and
		// absence of provider/legacy ownership in one SQL snapshot: a provider
		// reservation cannot appear after that token has been cancelled.
		const { results: cancelled = [] } = await requireDb(env).prepare(
			`SELECT c.start_token FROM studio_stream_cancelled_attempts AS c
			  WHERE c.session_id = ?
			    AND NOT EXISTS (SELECT 1 FROM studio_whip_provider_attempts AS p
			      WHERE p.session_id = c.session_id AND p.start_token = c.start_token)
			    AND NOT EXISTS (SELECT 1 FROM studio_whip_legacy_owners AS l
			      WHERE l.session_id = c.session_id AND l.start_token = c.start_token)`,
		).bind(sessionId).all<{ start_token: string }>();
		for (const cancelledAttempt of cancelled) {
			if (await matchesTakeoverObservation(sessionId, cancelledAttempt.start_token, observedLease)) return "revoked";
		}
		return "unknown";
	}
	if (row.state === "retired") return "revoked";
	if ((row.state === "reserved" || row.state === "creating" || row.state === "issued") && row.active_lease === 1) {
		return "active";
	}
	return "pending";
}

async function matchesTakeoverObservation(sessionId: string, token: string, observation: string): Promise<boolean> {
	const [starting, live] = await Promise.all([
		getStudioStreamTakeoverLeaseId(sessionId, { status: "starting", startToken: token }),
		getStudioStreamTakeoverLeaseId(sessionId, { status: "live", startToken: token }),
	]);
	return observation === starting || observation === live;
}

export async function reapWhipProviderAttempts(env: StudioEnv): Promise<{ deleted: number; pending: number }> {
	const db = requireDb(env);
	const { results = [] } = await db.prepare(
		`SELECT p.attempt_id, p.session_id, p.start_token, p.state, p.provider_account_id,
		        p.provider_input_id, p.idempotency_key, p.create_body
		   FROM studio_whip_provider_attempts AS p
		  WHERE p.state = 'revoking' OR (
		    p.state IN ('reserved', 'creating', 'issued') AND NOT EXISTS (
		      SELECT 1 FROM studio_sessions AS s
		       WHERE s.id = p.session_id AND s.status <> 'complete' AND s.stream_start_token = p.start_token
		         AND ((s.stream_status = 'starting' AND s.stream_heartbeat_at >= unixepoch() - 120)
		           OR (s.stream_status = 'live' AND s.stream_heartbeat_at >= unixepoch() - 20))
		    )
		  )
		  ORDER BY CASE WHEN p.stream_environment = 'prod' THEN 0 ELSE 1 END,
		           p.updated_at ASC, p.attempt_id ASC LIMIT 5`,
	).all<WhipAttemptRow>();
	let deleted = 0;
	const uncertain = await db.prepare(
		"SELECT COUNT(*) AS count FROM studio_whip_provider_attempts WHERE state = 'uncertain'",
	).first<{ count: number }>();
	let pending = uncertain?.count ?? 0;
	for (const attempt of results) {
		if (attempt.state !== "revoking") {
			// Compare the current session and heartbeat inside the write. A renewal
			// that wins first prevents expiry; a stale read cannot delete its input.
			const fenced = await db.prepare(
				`UPDATE studio_whip_provider_attempts
				    SET state = CASE state WHEN 'reserved' THEN 'retired'
				      WHEN 'creating' THEN 'uncertain' WHEN 'issued' THEN 'revoking' ELSE state END,
				        updated_at = unixepoch()
				  WHERE attempt_id = ? AND state = ? AND NOT EXISTS (
				    SELECT 1 FROM studio_sessions AS s
				     WHERE s.id = studio_whip_provider_attempts.session_id
				       AND s.status <> 'complete'
				       AND s.stream_start_token = studio_whip_provider_attempts.start_token
				       AND ((s.stream_status = 'starting' AND s.stream_heartbeat_at >= unixepoch() - 120)
				         OR (s.stream_status = 'live' AND s.stream_heartbeat_at >= unixepoch() - 20))
				  )`,
			).bind(attempt.attempt_id, attempt.state).run();
			if (!changed(fenced)) continue;
			await cancelStudioStreamAttempt(env, attempt.session_id, attempt.start_token).catch(() => undefined);
			if (attempt.state === "reserved") continue;
			if (attempt.state === "creating") { pending += 1; continue; }
		}
		const result = await retireKnownWhipProviderInput(env, attempt, 3_000);
		if (result === "deleted") deleted += 1;
		if (result === "pending") pending += 1;
	}
	return { deleted, pending };
}
