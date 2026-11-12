import type { StudioEnv } from "../env";
import type { StreamEnvironment } from "./studio";

export interface CloudflareStreamConfig {
	accountId: string;
	apiToken: string;
}

export interface CloudflareStreamLiveInput {
	created?: string;
	enabled?: boolean;
	meta?: Record<string, unknown>;
	modified?: string;
	status?: string | {
		current?: {
			ingestProtocol?: string;
			state?: string;
		} | null;
		history?: unknown[];
	} | null;
	uid: string;
	webRTC?: {
		url?: string;
	};
	webRTCPlayback?: {
		url?: string;
	};
}

interface CloudflareApiEnvelope<T> {
	errors?: Array<{ message?: string }>;
	result?: T;
	success?: boolean;
}

async function readSecretString(
	value: string | SecretsStoreSecret | undefined,
): Promise<string | null> {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	const secret = await value?.get();
	if (typeof secret !== "string") return null;
	const trimmed = secret.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export async function getCloudflareStreamConfig(
	env: StudioEnv,
): Promise<CloudflareStreamConfig | null> {
	const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
	const apiToken = await readSecretString(env.CLOUDFLARE_STREAM_API_TOKEN);
	if (!accountId || !apiToken) {
		return null;
	}
	return { accountId, apiToken };
}

export function cloudflareStreamLiveInputIsConnected(
	liveInput: Pick<CloudflareStreamLiveInput, "status">,
): boolean {
	const status = liveInput.status;
	const state = typeof status === "string" ? status : status?.current?.state;
	return state === "connected" || state === "reconnected";
}

export function createCloudflareStreamLiveInputBody(
	input: {
		contentVideoSlug: string | null;
		name: string;
		sessionId: string;
		streamEnvironment: StreamEnvironment;
	},
): string {
	return JSON.stringify({
		enabled: true,
		meta: {
			contentVideoSlug: input.contentVideoSlug,
			name: input.name,
			studioSessionId: input.sessionId,
			streamEnvironment: input.streamEnvironment,
		},
		recording: {
			hideLiveViewerCount: false,
			mode: "off",
			requireSignedURLs: false,
			timeoutSeconds: 0,
		},
	});
}

export async function createCloudflareStreamLiveInput(
	config: CloudflareStreamConfig,
	input: { body: string; idempotencyKey: string },
): Promise<CloudflareStreamLiveInput> {
	return await cloudflareStreamRequest<CloudflareStreamLiveInput>(
		config,
		"/stream/live_inputs",
		{
			method: "POST",
			headers: { "Idempotency-Key": input.idempotencyKey },
			body: input.body,
			signal: AbortSignal.timeout(10_000),
		},
	);
}

export async function deleteCloudflareStreamLiveInput(
	config: CloudflareStreamConfig,
	liveInputId: string,
	timeoutMs = 10_000,
): Promise<void> {
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/stream/live_inputs/${encodeURIComponent(liveInputId)}`,
		{
			method: "DELETE",
			headers: { Authorization: `Bearer ${config.apiToken}` },
			signal: AbortSignal.timeout(timeoutMs),
		},
	);
	const body = await response.json().catch(() => null) as unknown;
	// Cloudflare documents an empty object. A provider probe also returned an
	// explicit success envelope; accept only that complete, error-free shape.
	const object = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
	const emptyObject = object !== null && Object.keys(object).length === 0;
	const successEnvelope = object !== null && Object.keys(object).length === 4 &&
		object.success === true && object.result === "" &&
		Array.isArray(object.errors) && object.errors.length === 0 &&
		Array.isArray(object.messages) && object.messages.length === 0;
	if (response.status !== 200 || (!emptyObject && !successEnvelope)) {
		throw new Error(`Cloudflare Stream input deletion was not confirmed (${response.status}).`);
	}
}

export async function getCloudflareStreamLiveInput(
	config: CloudflareStreamConfig,
	liveInputId: string,
): Promise<CloudflareStreamLiveInput> {
	return await cloudflareStreamRequest<CloudflareStreamLiveInput>(
		config,
		`/stream/live_inputs/${encodeURIComponent(liveInputId)}`,
		{ method: "GET" },
	);
}

async function cloudflareStreamRequest<T>(
	config: CloudflareStreamConfig,
	pathname: string,
	init: RequestInit,
): Promise<T> {
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}${pathname}`,
		{
			...init,
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${config.apiToken}`,
				...init.headers,
			},
		},
	);
	const envelope = await response.json().catch(() => null) as
		| CloudflareApiEnvelope<T>
		| null;

	if (!response.ok || envelope?.success === false || !envelope?.result) {
		const message =
			envelope?.errors?.map((error) => error.message).filter(Boolean).join("; ") ||
			`Cloudflare Stream request failed with ${response.status}`;
		throw new Error(message);
	}

	return envelope.result;
}
