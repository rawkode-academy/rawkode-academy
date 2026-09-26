import type { StudioEnv, StudioUser } from "../env";
import { getCloudflareStreamConfig, type CloudflareStreamConfig } from "./cloudflare-stream";
import {
	getStudioSession,
	getStudioUserId,
	userCanManageStudioSession,
	type StudioSessionRecord,
} from "./studio";

export const cloudflareWhipLimitations = [
	"Broadcast metrics and player experience metrics are unavailable.",
	"Recording and live HLS/DASH playback are unavailable.",
	"Simulcasting or restreaming via RTMP/SRT is unavailable.",
	"Live viewer counts are unavailable.",
] as const;

export interface StreamOutputDestination {
	enabled: boolean;
	uid: string;
	url: string;
}

export interface StreamOutputReadiness {
	inputMode: "whip" | "rtmps-srt";
	managedOutputsReady: boolean;
	maxDestinations: number;
	outputInputState: "not-provisioned" | "provisioning" | "ready" | "uncertain";
	programmeDelivery: "browser-whip" | "external-encoder";
	provider: "cloudflare-stream";
	requirements: Array<{
		id: "cloudflare" | "external-encoder" | "output-input" | "programme-monitor";
		message: string;
		ready: boolean;
	}>;
	whipLimitations: readonly string[];
}

export interface StreamOutputState {
	destinations: StreamOutputDestination[];
	readiness: StreamOutputReadiness;
}

export interface StreamOutputIngestCredentials {
	rtmps: { streamKey: string; url: string };
	srt: { passphrase: string; streamId: string; url: string };
}

type OutputInputRow = {
	claim_token: string;
	claimed_at: number;
	cloudflare_live_input_id: string | null;
	provision_state: "provisioning" | "ready" | "uncertain";
};

type CloudflareLiveInput = {
	rtmps?: { streamKey?: string; url?: string };
	srt?: { passphrase?: string; streamId?: string; url?: string };
	uid?: string;
};

type CloudflareOutput = {
	enabled?: boolean;
	streamKey?: string;
	uid?: string;
	url?: string;
};

type CloudflareEnvelope<T> = {
	result?: T;
	success?: boolean;
};

export class StreamOutputError extends Error {
	constructor(
		readonly code:
			| "bad-request"
			| "conflict"
			| "not-found"
			| "provider-failed"
			| "provider-not-configured"
			| "storage-not-configured"
			| "unauthorized",
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "StreamOutputError";
	}
}

function requireDb(env: StudioEnv): D1Database {
	if (!env.STUDIO_DB) {
		throw new StreamOutputError(
			"storage-not-configured",
			"Studio output configuration storage is unavailable.",
			503,
		);
	}
	return env.STUDIO_DB;
}

async function requireConfig(env: StudioEnv): Promise<CloudflareStreamConfig> {
	let config: CloudflareStreamConfig | null;
	try {
		config = await getCloudflareStreamConfig(env);
	} catch {
		config = null;
	}
	if (!config) {
		throw new StreamOutputError(
			"provider-not-configured",
			"Cloudflare Stream output management is not configured.",
			503,
		);
	}
	return config;
}

export async function requireStreamOutputSession(
	env: StudioEnv,
	user: StudioUser,
	sessionId: string,
): Promise<StudioSessionRecord> {
	const session = await getStudioSession(env, sessionId);
	if (!session) {
		throw new StreamOutputError("not-found", "Studio session was not found.", 404);
	}
	if (!(await userCanManageStudioSession(env, session, user))) {
		throw new StreamOutputError(
			"unauthorized",
			"Studio session management access is required.",
			403,
		);
	}
	return session;
}

async function getOutputInput(
	env: StudioEnv,
	sessionId: string,
): Promise<OutputInputRow | null> {
	return await requireDb(env)
		.prepare(
			`SELECT claim_token, claimed_at, cloudflare_live_input_id, provision_state
			 FROM studio_stream_output_inputs
			 WHERE session_id = ?`,
		)
		.bind(sessionId)
		.first<OutputInputRow>();
}

function buildReadiness(
	input: OutputInputRow | null,
	cloudflareConfigured: boolean,
): StreamOutputReadiness {
	const inputReady = input?.provision_state === "ready" &&
		Boolean(input.cloudflare_live_input_id);
	const outputInputState = input?.provision_state ?? "not-provisioned";
	return {
		inputMode: inputReady ? "rtmps-srt" : "whip",
		managedOutputsReady: inputReady && cloudflareConfigured,
		maxDestinations: inputReady && cloudflareConfigured ? 50 : 0,
		outputInputState,
		programmeDelivery: inputReady ? "external-encoder" : "browser-whip",
		provider: "cloudflare-stream",
		requirements: [
			{
				id: "programme-monitor",
				message: "Open and verify the programme monitor from the producer room.",
				ready: false,
			},
			{
				id: "external-encoder",
				message: inputReady
					? "Capture the programme monitor in OBS or another encoder and publish with the ingest credentials."
					: "An external encoder is required; the browser does not relay WHIP into this input.",
				ready: false,
			},
			{
				id: "output-input",
				message: inputReady
					? "A separate RTMPS/SRT live input is provisioned for managed outputs."
					: outputInputState === "uncertain"
						? "The last provisioning request has an unknown provider outcome and requires operator reconciliation."
						: outputInputState === "provisioning"
							? "A separate RTMPS/SRT live input is currently provisioning."
							: "Provision a separate RTMPS/SRT live input for managed outputs.",
				ready: inputReady,
			},
			{
				id: "cloudflare",
				message: cloudflareConfigured
					? "Cloudflare Stream credentials are configured."
					: "Cloudflare Stream credentials are not configured.",
				ready: cloudflareConfigured,
			},
		],
		whipLimitations: cloudflareWhipLimitations,
	};
}

async function cloudflareConfigured(env: StudioEnv): Promise<boolean> {
	try {
		return Boolean(await getCloudflareStreamConfig(env));
	} catch {
		return false;
	}
}

function safeDestination(output: CloudflareOutput): StreamOutputDestination | null {
	if (!output.uid || !output.url) return null;
	let url: URL;
	try {
		url = new URL(output.url);
	} catch {
		return null;
	}
	if (!new Set(["rtmp:", "rtmps:"]).has(url.protocol) || !url.hostname) return null;
	const displayUrl = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}`;
	return { enabled: output.enabled === true, uid: output.uid, url: displayUrl };
}

async function cloudflareRequest<T>(
	config: CloudflareStreamConfig,
	path: string,
	init: RequestInit,
): Promise<T> {
	let response: Response;
	try {
		response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}${path}`,
			{
				...init,
				headers: {
					Authorization: `Bearer ${config.apiToken}`,
					"Content-Type": "application/json",
				},
			},
		);
	} catch {
		throw new StreamOutputError(
			"provider-failed",
			"Cloudflare Stream output management could not be reached.",
			502,
		);
	}
	const envelope = await response.json().catch(() => null) as CloudflareEnvelope<T> | null;
	if (!response.ok || envelope?.success === false || envelope?.result === undefined) {
		throw new StreamOutputError(
			"provider-failed",
			`Cloudflare Stream output management failed (${response.status}).`,
			502,
		);
	}
	return envelope.result;
}

async function cloudflareDelete(
	config: CloudflareStreamConfig,
	path: string,
): Promise<void> {
	let response: Response;
	try {
		response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}${path}`,
			{ method: "DELETE", headers: { Authorization: `Bearer ${config.apiToken}` } },
		);
	} catch {
		throw new StreamOutputError(
			"provider-failed",
			"Cloudflare Stream output management could not be reached.",
			502,
		);
	}
	const envelope = await response.json().catch(() => null) as CloudflareEnvelope<unknown> | null;
	if (!response.ok || envelope?.success === false) {
		if (response.status === 404) return;
		throw new StreamOutputError(
			"provider-failed",
			`Cloudflare Stream output management failed (${response.status}).`,
			502,
		);
	}
}

async function requireReadyInput(env: StudioEnv, sessionId: string) {
	const input = await getOutputInput(env, sessionId);
	if (input?.provision_state !== "ready" || !input.cloudflare_live_input_id) {
		throw new StreamOutputError(
			"conflict",
			"Managed outputs require a separately provisioned RTMPS/SRT input and an external encoder.",
			409,
		);
	}
	return { config: await requireConfig(env), liveInputId: input.cloudflare_live_input_id };
}

export async function getStreamOutputState(
	env: StudioEnv,
	user: StudioUser,
	sessionId: string,
): Promise<StreamOutputState> {
	await requireStreamOutputSession(env, user, sessionId);
	const input = await getOutputInput(env, sessionId);
	const configured = await cloudflareConfigured(env);
	const readiness = buildReadiness(input, configured);
	if (!readiness.managedOutputsReady || !input?.cloudflare_live_input_id) {
		return { destinations: [], readiness };
	}
	const config = await requireConfig(env);
	const result = await cloudflareRequest<CloudflareOutput[]>(
		config,
		`/stream/live_inputs/${encodeURIComponent(input.cloudflare_live_input_id)}/outputs`,
		{ method: "GET" },
	);
	return { destinations: result.map(safeDestination).filter((value) => value !== null), readiness };
}

function ingestCredentials(input: CloudflareLiveInput): StreamOutputIngestCredentials {
	const rtmps = input.rtmps;
	const srt = input.srt;
	if (!rtmps?.url || !rtmps.streamKey || !srt?.url || !srt.streamId || !srt.passphrase) {
		throw new StreamOutputError(
			"provider-failed",
			"Cloudflare Stream did not return complete RTMPS/SRT ingest credentials.",
			502,
		);
	}
	return {
		rtmps: { streamKey: rtmps.streamKey, url: rtmps.url },
		srt: { passphrase: srt.passphrase, streamId: srt.streamId, url: srt.url },
	};
}

const provisionClaimTtlSeconds = 300;

export async function provisionStreamOutputInput(
	env: StudioEnv,
	user: StudioUser,
	sessionId: string,
): Promise<{ credentials: StreamOutputIngestCredentials; state: StreamOutputState }> {
	const session = await requireStreamOutputSession(env, user, sessionId);
	if (session.status === "complete") {
		throw new StreamOutputError(
			"conflict",
			"Broadcast outputs cannot be provisioned for a completed Studio session.",
			409,
		);
	}
	const config = await requireConfig(env);
	const db = requireDb(env);
	const now = Math.floor(Date.now() / 1000);
	const claimToken = crypto.randomUUID();
	const existing = await getOutputInput(env, sessionId);
	if (existing?.provision_state === "ready") {
		throw new StreamOutputError(
			"conflict",
			"The RTMPS/SRT output input is already provisioned.",
			409,
		);
	}
	if (existing?.provision_state === "uncertain") {
		throw new StreamOutputError(
			"conflict",
			"A previous output-input request has an unknown provider outcome and requires operator reconciliation.",
			409,
		);
	}
	if (existing?.provision_state === "provisioning") {
		if (existing.claimed_at >= now - provisionClaimTtlSeconds) {
			throw new StreamOutputError(
				"conflict",
				"RTMPS/SRT output input provisioning is already in progress.",
				409,
			);
		}
		const fenced = await db.prepare(
			`UPDATE studio_stream_output_inputs
			 SET claim_token = ?, claimed_at = ?, created_by_id = ?, updated_at = ?
			 WHERE session_id = ? AND provision_state = 'provisioning' AND claim_token = ? AND claimed_at = ?`,
		).bind(
			claimToken,
			now,
			getStudioUserId(user),
			now,
			sessionId,
			existing.claim_token,
			existing.claimed_at,
		).run();
		if ((fenced.meta.changes ?? 0) !== 1) {
			throw new StreamOutputError(
				"conflict",
				"Output input provisioning changed during stale-claim recovery.",
				409,
			);
		}
		if (existing.cloudflare_live_input_id) {
			await cloudflareDelete(
				config,
				`/stream/live_inputs/${encodeURIComponent(existing.cloudflare_live_input_id)}`,
			);
			await db.prepare(
				`UPDATE studio_stream_output_inputs
				 SET cloudflare_live_input_id = NULL, updated_at = ?
				 WHERE session_id = ? AND provision_state = 'provisioning' AND claim_token = ?`,
			).bind(now, sessionId, claimToken).run();
		}
	} else {
		const claimed = await db.prepare(
			`INSERT INTO studio_stream_output_inputs (
				session_id, provision_state, claim_token, claimed_at, created_by_id, updated_at
			 ) VALUES (?, 'provisioning', ?, ?, ?, ?)
			 ON CONFLICT(session_id) DO NOTHING`,
		).bind(
			sessionId,
			claimToken,
			now,
			getStudioUserId(user),
			now,
		).run();
		if ((claimed.meta.changes ?? 0) !== 1) {
			throw new StreamOutputError(
				"conflict",
				"The RTMPS/SRT output input is already provisioned or provisioning is in progress.",
				409,
			);
		}
	}

	let liveInputId: string | null = null;
	let committed = false;
	try {
		const liveInput = await cloudflareRequest<CloudflareLiveInput>(
			config,
			"/stream/live_inputs",
			{
				method: "POST",
				body: JSON.stringify({
					enabled: true,
					meta: {
						name: `${session.title} — external encoder outputs`,
						studioPurpose: "external-encoder-outputs",
						studioSessionId: session.id,
					},
					recording: { mode: "off" },
				}),
			},
		);
		if (!liveInput.uid) {
			throw new StreamOutputError(
				"provider-failed",
				"Cloudflare Stream did not return a live input identifier.",
				502,
			);
		}
		liveInputId = liveInput.uid;
		const recordedInput = await db.prepare(
			`UPDATE studio_stream_output_inputs
			 SET cloudflare_live_input_id = ?, updated_at = ?
			 WHERE session_id = ? AND provision_state = 'provisioning' AND claim_token = ?`,
		).bind(liveInputId, now, sessionId, claimToken).run();
		if ((recordedInput.meta.changes ?? 0) !== 1) {
			throw new StreamOutputError(
				"conflict",
				"Output input provisioning lost ownership before its provider input could be saved.",
				409,
			);
		}
		const credentials = ingestCredentials(liveInput);
		const finalized = await db.prepare(
			`UPDATE studio_stream_output_inputs
			 SET provision_state = 'ready', cloudflare_live_input_id = ?,
			     created_at = COALESCE(created_at, ?), updated_at = ?
			 WHERE session_id = ? AND provision_state = 'provisioning' AND claim_token = ?`,
		).bind(liveInputId, now, now, sessionId, claimToken).run();
		if ((finalized.meta.changes ?? 0) !== 1) {
			throw new StreamOutputError(
				"conflict",
				"Output input provisioning lost ownership before it could be saved.",
				409,
			);
		}
		committed = true;
		return { credentials, state: await getStreamOutputState(env, user, sessionId) };
	} catch (error) {
		if (!committed) {
			const latest = await getOutputInput(env, sessionId).catch(() => undefined);
			if (
				latest?.provision_state === "ready" &&
				latest.cloudflare_live_input_id === liveInputId
			) {
				committed = true;
			} else if (
				latest?.provision_state === "provisioning" &&
				latest.claim_token === claimToken
			) {
				if (liveInputId === null) {
					await db.prepare(
						`UPDATE studio_stream_output_inputs
						 SET provision_state = 'uncertain', updated_at = ?
						 WHERE session_id = ? AND provision_state = 'provisioning' AND claim_token = ?`,
					).bind(now, sessionId, claimToken).run().catch(() => undefined);
					throw error;
				}
				let providerCleaned = liveInputId === null;
				if (liveInputId) {
					providerCleaned = await cloudflareDelete(
						config,
						`/stream/live_inputs/${encodeURIComponent(liveInputId)}`,
					).then(() => true).catch(() => false);
				}
				if (providerCleaned) {
					await db.prepare(
						"DELETE FROM studio_stream_output_inputs WHERE session_id = ? AND claim_token = ? AND provision_state = 'provisioning'",
					).bind(sessionId, claimToken).run().catch(() => undefined);
				}
			}
		}
		throw error;
	}
}

export async function getStreamOutputCredentials(
	env: StudioEnv,
	user: StudioUser,
	sessionId: string,
): Promise<StreamOutputIngestCredentials> {
	await requireStreamOutputSession(env, user, sessionId);
	const { config, liveInputId } = await requireReadyInput(env, sessionId);
	const liveInput = await cloudflareRequest<CloudflareLiveInput>(
		config,
		`/stream/live_inputs/${encodeURIComponent(liveInputId)}`,
		{ method: "GET" },
	);
	return ingestCredentials(liveInput);
}

export function validateOutputTarget(urlValue: unknown, streamKeyValue: unknown) {
	if (typeof urlValue !== "string" || urlValue.length > 2048) {
		throw new StreamOutputError("bad-request", "A valid RTMP output URL is required.", 400);
	}
	let url: URL;
	try {
		url = new URL(urlValue);
	} catch {
		throw new StreamOutputError("bad-request", "A valid RTMP output URL is required.", 400);
	}
	if (!new Set(["rtmp:", "rtmps:"]).has(url.protocol) || !url.hostname) {
		throw new StreamOutputError("bad-request", "Output URLs must use RTMP or RTMPS.", 400);
	}
	if (url.username || url.password || url.search || url.hash) {
		throw new StreamOutputError(
			"bad-request",
			"Output credentials and query parameters must not be embedded in the URL.",
			400,
		);
	}
	const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
	if (
		host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0" ||
		host === "::" || host === "::1" || /^127\./.test(host) || /^10\./.test(host) ||
		/^192\.168\./.test(host) || /^169\.254\./.test(host) ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^(fc|fd|fe8|fe9|fea|feb)/i.test(host)
	) {
		throw new StreamOutputError("bad-request", "Local and private output targets are not allowed.", 400);
	}
	if (
		typeof streamKeyValue !== "string" || streamKeyValue.length < 1 ||
		streamKeyValue.length > 2048 || /[\r\n]/.test(streamKeyValue)
	) {
		throw new StreamOutputError("bad-request", "A valid output stream key is required.", 400);
	}
	return { streamKey: streamKeyValue, url: url.toString().replace(/\/$/, url.pathname === "/" ? "" : "/") };
}

function requireOutputId(value: unknown): string {
	if (typeof value !== "string" || !/^[a-f0-9]{32}$/i.test(value)) {
		throw new StreamOutputError("bad-request", "A valid output identifier is required.", 400);
	}
	return value;
}

export async function createStreamOutputDestination(
	env: StudioEnv,
	user: StudioUser,
	input: { sessionId: string; streamKey: unknown; url: unknown },
): Promise<StreamOutputDestination> {
	await requireStreamOutputSession(env, user, input.sessionId);
	const target = validateOutputTarget(input.url, input.streamKey);
	const { config, liveInputId } = await requireReadyInput(env, input.sessionId);
	const output = await cloudflareRequest<CloudflareOutput>(
		config,
		`/stream/live_inputs/${encodeURIComponent(liveInputId)}/outputs`,
		{ method: "POST", body: JSON.stringify({ ...target, enabled: false }) },
	);
	const safe = safeDestination(output);
	if (!safe) {
		throw new StreamOutputError("provider-failed", "Cloudflare Stream returned an incomplete output.", 502);
	}
	return safe;
}

export async function setStreamOutputDestinationEnabled(
	env: StudioEnv,
	user: StudioUser,
	input: { enabled: unknown; outputId: unknown; sessionId: string },
): Promise<StreamOutputDestination> {
	await requireStreamOutputSession(env, user, input.sessionId);
	if (typeof input.enabled !== "boolean") {
		throw new StreamOutputError("bad-request", "enabled must be a boolean.", 400);
	}
	const outputId = requireOutputId(input.outputId);
	const { config, liveInputId } = await requireReadyInput(env, input.sessionId);
	const output = await cloudflareRequest<CloudflareOutput>(
		config,
		`/stream/live_inputs/${encodeURIComponent(liveInputId)}/outputs/${encodeURIComponent(outputId)}`,
		{ method: "PUT", body: JSON.stringify({ enabled: input.enabled }) },
	);
	const safe = safeDestination(output);
	if (!safe) {
		throw new StreamOutputError("provider-failed", "Cloudflare Stream returned an incomplete output.", 502);
	}
	return safe;
}

export async function deleteStreamOutputDestination(
	env: StudioEnv,
	user: StudioUser,
	input: { outputId: unknown; sessionId: string },
): Promise<void> {
	await requireStreamOutputSession(env, user, input.sessionId);
	const outputId = requireOutputId(input.outputId);
	const { config, liveInputId } = await requireReadyInput(env, input.sessionId);
	await cloudflareDelete(
		config,
		`/stream/live_inputs/${encodeURIComponent(liveInputId)}/outputs/${encodeURIComponent(outputId)}`,
	);
}
