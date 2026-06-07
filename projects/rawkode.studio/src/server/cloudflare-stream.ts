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
	status?: string;
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
	return liveInput.status === "connected" || liveInput.status === "reconnected";
}

export async function createCloudflareStreamLiveInput(
	config: CloudflareStreamConfig,
	input: {
		contentVideoSlug: string | null;
		name: string;
		sessionId: string;
		streamEnvironment: StreamEnvironment;
	},
): Promise<CloudflareStreamLiveInput> {
	return await cloudflareStreamRequest<CloudflareStreamLiveInput>(
		config,
		"/stream/live_inputs",
		{
			method: "POST",
			body: JSON.stringify({
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
			}),
		},
	);
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
