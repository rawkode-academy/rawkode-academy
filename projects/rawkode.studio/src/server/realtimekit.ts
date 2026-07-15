export type RealtimeKitRole = "guest" | "host" | "producer" | "program";

export interface RealtimeKitMeeting {
	id: string;
	title?: string;
	recordOnStart?: boolean;
}

export interface RealtimeKitParticipantToken {
	participantId: string;
	token: string;
}

interface RealtimeKitConfig {
	accountId: string;
	apiToken: string;
	appId: string;
	presets: Record<RealtimeKitRole, string>;
}

interface CloudflareEnvelope<T> {
	success: boolean;
	errors?: Array<{ code?: number | string; message?: string }>;
	messages?: Array<{ code?: number | string; message?: string }>;
	data?: T;
	result?: T;
}

const MAX_REALTIMEKIT_ERROR_DETAILS = 3;
const MAX_REALTIMEKIT_ERROR_CODE = 9_999_999_999;

function realtimeKitApiError(
	status: number,
	body: CloudflareEnvelope<unknown> | null,
): Error {
	const codes = [...(body?.errors ?? []), ...(body?.messages ?? [])]
		.map((detail) => detail.code)
		.filter((code): code is number =>
			typeof code === "number" &&
			Number.isInteger(code) &&
			code >= 0 &&
			code <= MAX_REALTIMEKIT_ERROR_CODE
		)
		.slice(0, MAX_REALTIMEKIT_ERROR_DETAILS);
	const suffix = codes.length > 0
		? `: ${codes.map((code) => `[${String(code)}]`).join("; ")}`
		: "";
	return new Error(`RealtimeKit API returned ${status}${suffix}`);
}

function readEnvString(env: unknown, key: string): string | undefined {
	const value = (env as Record<string, unknown>)[key];
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function readEnvSecret(
	env: unknown,
	key: string,
): Promise<string | undefined> {
	const value = (env as Record<string, unknown>)[key];
	if (typeof value === "string") {
		return value.trim() || undefined;
	}
	if (!value || typeof value !== "object" || !("get" in value)) {
		return undefined;
	}

	const get = (value as { get?: unknown }).get;
	if (typeof get !== "function") return undefined;
	// Secrets Store methods are Workers RPC method proxies. Invoking `.call` on
	// the extracted proxy asks the remote receiver for a method named `call`.
	const secret = await (value as SecretsStoreSecret).get();
	return typeof secret === "string" && secret.trim()
		? secret.trim()
		: undefined;
}

export async function getRealtimeKitConfig(
	env: unknown,
): Promise<RealtimeKitConfig | null> {
	const accountId = readEnvString(env, "CLOUDFLARE_ACCOUNT_ID");
	const [apiToken, appId] = await Promise.all([
		readEnvSecret(env, "REALTIMEKIT_API_TOKEN"),
		readEnvSecret(env, "REALTIMEKIT_APP_ID"),
	]);
	if (!accountId || !apiToken || !appId) return null;

	return {
		accountId,
		apiToken,
		appId,
		presets: {
			host: readEnvString(env, "REALTIMEKIT_HOST_PRESET") ?? "host",
			producer: readEnvString(env, "REALTIMEKIT_PRODUCER_PRESET") ?? "producer",
			guest: readEnvString(env, "REALTIMEKIT_GUEST_PRESET") ?? "guest",
			program: readEnvString(env, "REALTIMEKIT_PROGRAM_PRESET") ?? "program",
		},
	};
}

async function realtimeKitFetch<T>(
	config: RealtimeKitConfig,
	pathname: string,
	init: RequestInit,
): Promise<T> {
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/realtime/kit/${config.appId}${pathname}`,
		{
			...init,
			headers: {
				Authorization: `Bearer ${config.apiToken}`,
				"Content-Type": "application/json",
				...(init.headers ?? {}),
			},
		},
	);
	const body = await response.json().catch(() => null) as CloudflareEnvelope<T> | null;
	if (!response.ok || !body?.success) {
		throw realtimeKitApiError(response.status, body);
	}

	const data = body.data ?? body.result;
	if (!data) {
		throw new Error("RealtimeKit API returned an empty response");
	}
	return data;
}

async function realtimeKitFetchOptional<T>(
	config: RealtimeKitConfig,
	pathname: string,
	init: RequestInit,
): Promise<T | null> {
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/realtime/kit/${config.appId}${pathname}`,
		{
			...init,
			headers: {
				Authorization: `Bearer ${config.apiToken}`,
				"Content-Type": "application/json",
				...(init.headers ?? {}),
			},
		},
	);
	const body = await response.json().catch(() => null) as CloudflareEnvelope<T> | null;
	if (!response.ok || body?.success === false) {
		throw realtimeKitApiError(response.status, body);
	}

	return body?.data ?? body?.result ?? null;
}

export async function createRealtimeKitMeeting(
	config: RealtimeKitConfig,
	input: { title: string },
): Promise<RealtimeKitMeeting> {
	const data = await realtimeKitFetch<{ id: string; title?: string; record_on_start?: boolean }>(
		config,
		"/meetings",
		{
			method: "POST",
			body: JSON.stringify({
				title: input.title,
			}),
		},
	);

	return {
		id: data.id,
		title: data.title,
		recordOnStart: data.record_on_start,
	};
}

export async function endRealtimeKitSession(
	config: RealtimeKitConfig,
	meetingId: string,
): Promise<void> {
	await realtimeKitFetchOptional(
		config,
		`/meetings/${meetingId}/active-session/kick-all`,
		{ method: "POST" },
	).catch(() => undefined);
	await realtimeKitFetchOptional(
		config,
		`/meetings/${meetingId}`,
		{
			method: "PATCH",
			body: JSON.stringify({ status: "INACTIVE" }),
		},
	);
}

export async function addRealtimeKitParticipant(
	config: RealtimeKitConfig,
	input: {
		meetingId: string;
		participantId: string;
		role: RealtimeKitRole;
		name: string;
		picture?: string | null;
	},
): Promise<RealtimeKitParticipantToken> {
	const data = await realtimeKitFetch<{ id: string; token: string }>(
		config,
		`/meetings/${input.meetingId}/participants`,
		{
			method: "POST",
			body: JSON.stringify({
				custom_participant_id: `studio:${input.role}:${input.participantId}`,
				preset_name: config.presets[input.role],
				name: input.name,
				picture: input.picture ?? undefined,
			}),
		},
	);

	return {
		participantId: data.id,
		token: data.token,
	};
}
