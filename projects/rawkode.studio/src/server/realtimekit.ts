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
	errors?: Array<{ code?: number; message: string }>;
	data?: T;
	result?: T;
}

function readEnvString(env: unknown, key: string): string | undefined {
	const value = (env as Record<string, unknown>)[key];
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function getRealtimeKitConfig(env: unknown): RealtimeKitConfig | null {
	const accountId = readEnvString(env, "CLOUDFLARE_ACCOUNT_ID");
	const apiToken = readEnvString(env, "REALTIMEKIT_API_TOKEN");
	const appId = readEnvString(env, "REALTIMEKIT_APP_ID");
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
	const body = (await response.json()) as CloudflareEnvelope<T>;
	if (!response.ok || !body.success) {
		const message =
			body.errors?.map((error) => error.message).join("; ") ||
			`RealtimeKit API returned ${response.status}`;
		throw new Error(message);
	}

	const data = body.data ?? body.result;
	if (!data) {
		throw new Error("RealtimeKit API returned an empty response");
	}
	return data;
}

export async function createRealtimeKitMeeting(
	config: RealtimeKitConfig,
	input: { sessionId: string; title: string },
): Promise<RealtimeKitMeeting> {
	const data = await realtimeKitFetch<{ id: string; title?: string; record_on_start?: boolean }>(
		config,
		"/meetings",
		{
			method: "POST",
			body: JSON.stringify({
				title: input.title,
				record_on_start: false,
				recording_config: {
					file_name_prefix: `studio/${input.sessionId}`,
				},
			}),
		},
	);

	return {
		id: data.id,
		title: data.title,
		recordOnStart: data.record_on_start,
	};
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
				custom_participant_id: input.participantId,
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
