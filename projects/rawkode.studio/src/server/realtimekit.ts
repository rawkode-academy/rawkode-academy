export type RealtimeKitRole = "guest" | "host" | "producer" | "program";

export interface RealtimeKitMeeting {
	id: string;
	title?: string;
	recordOnStart?: boolean;
}

export interface RealtimeKitParticipantToken {
	customParticipantId: string;
	participantId: string;
	token: string;
}

export interface RealtimeKitParticipantIdentity {
	customParticipantId: string;
	participantId: string;
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
	paging?: {
		end_offset: number;
		start_offset: number;
		total_count: number;
	};
	result?: T;
}

const MAX_REALTIMEKIT_ERROR_DETAILS = 3;
const MAX_REALTIMEKIT_ERROR_CODE = 9_999_999_999;

export class RealtimeKitApiError extends Error {
	readonly codes: number[];
	readonly status: number;

	constructor(status: number, codes: number[]) {
		const suffix = codes.length > 0
			? `: ${codes.map((code) => `[${String(code)}]`).join("; ")}`
			: "";
		super(`RealtimeKit API returned ${status}${suffix}`);
		this.codes = codes;
		this.status = status;
	}
}

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
	return new RealtimeKitApiError(status, codes);
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
			host: readEnvString(env, "REALTIMEKIT_HOST_PRESET") ?? "group_call_host",
			producer:
				readEnvString(env, "REALTIMEKIT_PRODUCER_PRESET") ?? "group_call_host",
			guest: readEnvString(env, "REALTIMEKIT_GUEST_PRESET") ?? "group_call_guest",
			program:
				readEnvString(env, "REALTIMEKIT_PROGRAM_PRESET") ?? "group_call_host",
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

async function realtimeKitFetchPage<T>(
	config: RealtimeKitConfig,
	pathname: string,
): Promise<Pick<CloudflareEnvelope<T>, "data" | "paging">> {
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/realtime/kit/${config.appId}${pathname}`,
		{
			headers: {
				Authorization: `Bearer ${config.apiToken}`,
				"Content-Type": "application/json",
			},
			method: "GET",
		},
	);
	const body = await response.json().catch(() => null) as CloudflareEnvelope<T> | null;
	if (!response.ok || !body?.success || !body.data) {
		throw realtimeKitApiError(response.status, body);
	}
	return { data: body.data, paging: body.paging };
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
		customParticipantId?: string | null;
		legacyParticipantId?: string | null;
		meetingId: string;
		participantId: string;
		role: RealtimeKitRole;
		name: string;
		picture?: string | null;
	},
): Promise<RealtimeKitParticipantToken> {
	const preferredCustomParticipantId = createRealtimeKitCustomParticipantId(
		input.role,
		input.participantId,
	);
	const customParticipantId = input.customParticipantId ?? preferredCustomParticipantId;
	const legacyCustomParticipantId = input.legacyParticipantId
		? createRealtimeKitCustomParticipantId(input.role, input.legacyParticipantId)
		: null;
	const candidateCustomParticipantIds = [...new Set([
		legacyCustomParticipantId,
		input.customParticipantId,
		preferredCustomParticipantId,
	].filter((candidate): candidate is string => Boolean(candidate)))];
	let existing = await findRealtimeKitParticipant(
		config,
		input.meetingId,
		candidateCustomParticipantIds,
	);
	if (existing) {
		try {
			return await refreshRealtimeKitParticipantToken(
				config,
				input.meetingId,
				existing.id,
				existing.custom_participant_id,
			);
		} catch (error) {
			existing = await findRealtimeKitParticipant(
				config,
				input.meetingId,
				candidateCustomParticipantIds,
			).catch(() => existing);
			if (existing) throw error;
		}
	}

	let data: { id: string; token: string };
	try {
		data = await realtimeKitFetch<{ id: string; token: string }>(
			config,
			`/meetings/${input.meetingId}/participants`,
			{
				method: "POST",
				body: JSON.stringify({
					custom_participant_id: customParticipantId,
					preset_name: config.presets[input.role],
					name: input.name,
					picture: getRealtimeKitPicture(input.picture),
				}),
			},
		);
	} catch (error) {
		const racedParticipant = await findRealtimeKitParticipant(
			config,
			input.meetingId,
			[customParticipantId],
		).catch(() => null);
		if (!racedParticipant) throw error;
		return await refreshRealtimeKitParticipantToken(
			config,
			input.meetingId,
			racedParticipant.id,
			racedParticipant.custom_participant_id,
		);
	}
	if (!isNonEmptyString(data.id) || !isNonEmptyString(data.token)) {
		throw new Error("RealtimeKit API returned an invalid participant response");
	}

	return {
		customParticipantId,
		participantId: data.id,
		token: data.token,
	};
}

export function createRealtimeKitCustomParticipantId(
	role: RealtimeKitRole,
	participantId: string,
): string {
	return `studio:${role}:${participantId}`;
}

export async function getRealtimeKitParticipantIdentity(
	config: RealtimeKitConfig,
	input: {
		customParticipantIds: string[];
		meetingId: string;
	},
): Promise<RealtimeKitParticipantIdentity | null> {
	const participant = await findRealtimeKitParticipant(
		config,
		input.meetingId,
		input.customParticipantIds,
	);
	return participant
		? {
				customParticipantId: participant.custom_participant_id,
				participantId: participant.id,
			}
		: null;
}

interface RealtimeKitParticipantData {
	custom_participant_id: string;
	id: string;
}

async function findRealtimeKitParticipant(
	config: RealtimeKitConfig,
	meetingId: string,
	customParticipantIds: string[],
): Promise<RealtimeKitParticipantData | null> {
	const participantsByCustomId = new Map<string, RealtimeKitParticipantData>();
	const seenParticipantIds = new Set<string>();
	for (let pageNo = 1; ; pageNo += 1) {
		const page = await realtimeKitFetchPage<RealtimeKitParticipantData[]>(
			config,
			`/meetings/${meetingId}/participants?page_no=${pageNo}&per_page=100`,
		);
		let newParticipantCount = 0;
		for (const participant of page.data ?? []) {
			if (
				!isNonEmptyString(participant.id) ||
				!isNonEmptyString(participant.custom_participant_id)
			) {
				throw new Error("RealtimeKit API returned an invalid participant list");
			}
			if (!seenParticipantIds.has(participant.id)) {
				seenParticipantIds.add(participant.id);
				newParticipantCount += 1;
			}
			if (customParticipantIds.includes(participant.custom_participant_id)) {
				participantsByCustomId.set(participant.custom_participant_id, participant);
			}
		}
		const reachedLastPage = page.paging
			? page.paging.end_offset >= page.paging.total_count
			: (page.data?.length ?? 0) < 100;
		if (reachedLastPage) break;
		if (newParticipantCount === 0) {
			throw new Error("RealtimeKit participant pagination did not advance");
		}
	}
	for (const customParticipantId of customParticipantIds) {
		const participant = participantsByCustomId.get(customParticipantId);
		if (participant) return participant;
	}
	return null;
}

async function refreshRealtimeKitParticipantToken(
	config: RealtimeKitConfig,
	meetingId: string,
	participantId: string,
	customParticipantId: string,
): Promise<RealtimeKitParticipantToken> {
	const data = await realtimeKitFetch<{ token: string }>(
		config,
		`/meetings/${meetingId}/participants/${participantId}/token`,
		{ method: "POST" },
	);
	if (!isNonEmptyString(data.token)) {
		throw new Error("RealtimeKit API returned an invalid token response");
	}
	return { customParticipantId, participantId, token: data.token };
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function getRealtimeKitPicture(picture: string | null | undefined): string | undefined {
	if (!picture || picture.length > 2_048) return undefined;
	try {
		const url = new URL(picture);
		return url.protocol === "https:" || url.protocol === "http:"
			? picture
			: undefined;
	} catch {
		return undefined;
	}
}
