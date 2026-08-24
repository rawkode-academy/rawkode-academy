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

export interface RealtimeKitMeetingParticipant {
	customParticipantId: string;
	name?: string;
	participantId: string;
	picture?: string;
	presetName?: string;
}

export interface RealtimeKitConfig {
	accountId: string;
	apiToken: string;
	appId: string;
	presets: Record<RealtimeKitRole, string>;
}

export type RealtimeKitProviderOperation =
	| "add-participant"
	| "create-meeting"
	| "disable-meeting"
	| "kick-all"
	| "list-participants"
	| "refresh-participant-token";

export type RealtimeKitProviderFailureKind =
	| "invalid-response"
	| "network"
	| "provider";

export class RealtimeKitProviderError extends Error {
	readonly failureKind: RealtimeKitProviderFailureKind;
	readonly httpStatus: number | null;
	readonly operation: RealtimeKitProviderOperation;
	readonly providerCodes: readonly string[];
	readonly rayId: string | null;

	constructor(input: {
		failureKind: RealtimeKitProviderFailureKind;
		httpStatus?: number | null;
		operation: RealtimeKitProviderOperation;
		providerCodes?: string[];
		rayId?: string | null;
	}) {
		const context: string[] = [];
		if (input.httpStatus !== undefined && input.httpStatus !== null) {
			context.push(`HTTP ${input.httpStatus}`);
		} else {
			context.push(input.failureKind);
		}
		if (input.providerCodes?.length) {
			context.push(`provider code ${input.providerCodes.join(",")}`);
		}
		if (input.rayId) {
			context.push(`ray ${input.rayId}`);
		}
		super(`RealtimeKit ${input.operation} failed (${context.join("; ")}).`);
		this.name = "RealtimeKitProviderError";
		this.failureKind = input.failureKind;
		this.httpStatus = input.httpStatus ?? null;
		this.operation = input.operation;
		this.providerCodes = Object.freeze([...(input.providerCodes ?? [])]);
		this.rayId = input.rayId ?? null;
	}
}

interface CloudflareEnvelope<T> {
	data?: T | null;
	errors?: Array<{ code?: number | string; message?: string }>;
	paging?: {
		end_offset?: number;
		start_offset?: number;
		total_count?: number;
	};
	result?: T | null;
	result_info?: {
		page?: number;
		per_page?: number;
		total_count?: number;
		total_pages?: number;
	};
	success?: boolean;
}

interface RealtimeKitRequestContext {
	httpStatus: number;
	rayId: string | null;
}

interface RealtimeKitEnvelopeResponse<T> extends RealtimeKitRequestContext {
	body: CloudflareEnvelope<T>;
}

interface RealtimeKitValueResponse<T> extends RealtimeKitRequestContext {
	value: T;
}

const participantPageSize = 100;
const participantMaxCount = 1_000;
const participantPageLimit = Math.ceil(participantMaxCount / participantPageSize);

function readEnvString(env: unknown, key: string): string | undefined {
	const value = (env as Record<string, unknown>)[key];
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function readSecretString(value: unknown): Promise<string | undefined> {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed || undefined;
	}
	if (
		typeof value !== "object" ||
		value === null ||
		!("get" in value) ||
		typeof value.get !== "function"
	) {
		return undefined;
	}

	let secret: unknown;
	try {
		secret = await value.get();
	} catch (error) {
		if (error instanceof Error && /not found/i.test(error.message)) {
			return undefined;
		}
		throw error;
	}
	if (typeof secret !== "string") return undefined;
	const trimmed = secret.trim();
	return trimmed || undefined;
}

export async function getRealtimeKitConfig(
	env: unknown,
): Promise<RealtimeKitConfig | null> {
	const accountId = readEnvString(env, "CLOUDFLARE_ACCOUNT_ID");
	const bindings = env as Record<string, unknown>;
	const [apiToken, appId] = await Promise.all([
		readSecretString(bindings.REALTIMEKIT_API_TOKEN),
		readSecretString(bindings.REALTIMEKIT_APP_ID),
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeProviderCode(value: unknown): string | null {
	if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
		return String(value);
	}
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return /^\d{1,20}$/.test(trimmed)
		? trimmed
		: null;
}

function getProviderCodes(body: CloudflareEnvelope<unknown> | null): string[] {
	return [
		...new Set(
			(body?.errors ?? [])
				.map((error) => safeProviderCode(error.code))
				.filter((code): code is string => code !== null),
		),
	];
}

function getRayId(response: Response): string | null {
	const value = response.headers.get("cf-ray")?.trim();
	return value && /^[a-fA-F0-9]{6,32}-[A-Z]{3}$/.test(value)
		? value
		: null;
}

async function realtimeKitRequest<T>(
	config: RealtimeKitConfig,
	operation: RealtimeKitProviderOperation,
	pathname: string,
	init: RequestInit,
): Promise<RealtimeKitEnvelopeResponse<T>> {
	let response: Response;
	try {
		response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/realtime/kit/${encodeURIComponent(config.appId)}${pathname}`,
			{
				...init,
				headers: {
					Authorization: `Bearer ${config.apiToken}`,
					"Content-Type": "application/json",
					...(init.headers ?? {}),
				},
			},
		);
	} catch {
		throw new RealtimeKitProviderError({
			failureKind: "network",
			operation,
		});
	}

	const rayId = getRayId(response);
	const decoded = await response.json().catch(() => null);
	const body = isRecord(decoded)
		? (decoded as CloudflareEnvelope<T>)
		: null;
	if (!response.ok || body?.success === false) {
		throw new RealtimeKitProviderError({
			failureKind: "provider",
			httpStatus: response.status,
			operation,
			providerCodes: getProviderCodes(body),
			rayId,
		});
	}
	if (!body) {
		throw new RealtimeKitProviderError({
			failureKind: "invalid-response",
			httpStatus: response.status,
			operation,
			rayId,
		});
	}

	return {
		body,
		httpStatus: response.status,
		rayId,
	};
}

function getEnvelopeValue<T>(body: CloudflareEnvelope<T>): T | null | undefined {
	if (Object.hasOwn(body, "data")) return body.data;
	if (Object.hasOwn(body, "result")) return body.result;
	return undefined;
}

function invalidResponse(
	operation: RealtimeKitProviderOperation,
	context: Partial<RealtimeKitRequestContext> = {},
): RealtimeKitProviderError {
	return new RealtimeKitProviderError({
		failureKind: "invalid-response",
		httpStatus: context.httpStatus,
		operation,
		rayId: context.rayId,
	});
}

async function realtimeKitFetch<T>(
	config: RealtimeKitConfig,
	operation: RealtimeKitProviderOperation,
	pathname: string,
	init: RequestInit,
): Promise<RealtimeKitValueResponse<T>> {
	const response = await realtimeKitRequest<T>(config, operation, pathname, init);
	const value = getEnvelopeValue(response.body);
	if (value === undefined || value === null) {
		throw invalidResponse(operation, response);
	}
	return {
		httpStatus: response.httpStatus,
		rayId: response.rayId,
		value,
	};
}

async function realtimeKitFetchOptional<T>(
	config: RealtimeKitConfig,
	operation: RealtimeKitProviderOperation,
	pathname: string,
	init: RequestInit,
): Promise<T | null> {
	const response = await realtimeKitRequest<T>(config, operation, pathname, init);
	return getEnvelopeValue(response.body) ?? null;
}

function normalizeIdentityPart(value: string): string {
	const normalized = value.trim();
	if (!normalized) {
		throw new TypeError("RealtimeKit participant identity requires non-empty inputs.");
	}
	return normalized;
}

export async function createRealtimeKitCustomParticipantId(input: {
	meetingId: string;
	participantId: string;
	role: RealtimeKitRole;
}): Promise<string> {
	const identity = JSON.stringify([
		"rawkode-studio-participant-v1",
		normalizeIdentityPart(input.meetingId),
		input.role,
		normalizeIdentityPart(input.participantId),
	]);
	const digest = new Uint8Array(
		await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity)),
	);
	const encoded = [...digest]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
	return `studio:${input.role}:v1:${encoded}`;
}

export function createLegacyRealtimeKitCustomParticipantId(input: {
	participantId: string;
	role: RealtimeKitRole;
}): string {
	return `studio:${input.role}:${normalizeIdentityPart(input.participantId)}`;
}

export async function createRealtimeKitMeeting(
	config: RealtimeKitConfig,
	input: { sessionId: string; title: string },
): Promise<RealtimeKitMeeting> {
	const response = await realtimeKitFetch<{
		id?: string;
		record_on_start?: boolean;
		title?: string;
	}>(config, "create-meeting", "/meetings", {
		method: "POST",
		body: JSON.stringify({
			title: input.title,
			record_on_start: false,
			recording_config: {
				file_name_prefix: `studio/${input.sessionId}`,
			},
		}),
	});
	if (typeof response.value.id !== "string" || !response.value.id) {
		throw invalidResponse("create-meeting", response);
	}

	return {
		id: response.value.id,
		title: response.value.title,
		recordOnStart: response.value.record_on_start,
	};
}

export async function endRealtimeKitSession(
	config: RealtimeKitConfig,
	meetingId: string,
): Promise<void> {
	const encodedMeetingId = encodeURIComponent(meetingId);
	await realtimeKitFetchOptional(
		config,
		"kick-all",
		`/meetings/${encodedMeetingId}/active-session/kick-all`,
		{ method: "POST" },
	).catch(() => undefined);
	await realtimeKitFetchOptional(
		config,
		"disable-meeting",
		`/meetings/${encodedMeetingId}`,
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
	const customParticipantId = await createRealtimeKitCustomParticipantId(input);
	const response = await realtimeKitFetch<{ id?: string; token?: string }>(
		config,
		"add-participant",
		`/meetings/${encodeURIComponent(input.meetingId)}/participants`,
		{
			method: "POST",
			body: JSON.stringify({
				custom_participant_id: customParticipantId,
				preset_name: config.presets[input.role],
				name: input.name,
				picture: input.picture ?? undefined,
			}),
		},
	);
	if (
		typeof response.value.id !== "string" ||
		!response.value.id ||
		typeof response.value.token !== "string" ||
		!response.value.token
	) {
		throw invalidResponse("add-participant", response);
	}

	return {
		participantId: response.value.id,
		token: response.value.token,
	};
}

export async function refreshRealtimeKitParticipantToken(
	config: RealtimeKitConfig,
	input: {
		meetingId: string;
		realtimeKitParticipantId: string;
	},
): Promise<RealtimeKitParticipantToken> {
	const response = await realtimeKitFetch<{ token?: string }>(
		config,
		"refresh-participant-token",
		`/meetings/${encodeURIComponent(input.meetingId)}/participants/${encodeURIComponent(input.realtimeKitParticipantId)}/token`,
		{ method: "POST" },
	);
	if (typeof response.value.token !== "string" || !response.value.token) {
		throw invalidResponse("refresh-participant-token", response);
	}
	return {
		participantId: input.realtimeKitParticipantId,
		token: response.value.token,
	};
}

function shouldFetchNextParticipantPage(input: {
	itemCount: number;
	pageNumber: number;
	paging?: CloudflareEnvelope<unknown>["paging"];
	resultInfo?: CloudflareEnvelope<unknown>["result_info"];
	seenCount: number;
}): boolean {
	if (input.itemCount === 0) return false;
	const totalCount = input.paging?.total_count ?? input.resultInfo?.total_count;
	if (typeof totalCount === "number" && Number.isFinite(totalCount)) {
		return input.seenCount < totalCount;
	}
	const totalPages = input.resultInfo?.total_pages;
	if (typeof totalPages === "number" && Number.isFinite(totalPages)) {
		return input.pageNumber < totalPages;
	}
	return input.itemCount >= participantPageSize;
}

export async function findRealtimeKitParticipantByCustomId(
	config: RealtimeKitConfig,
	input: {
		customParticipantId: string;
		meetingId: string;
	},
): Promise<RealtimeKitMeetingParticipant | null> {
	let seenCount = 0;
	for (let pageNumber = 1; pageNumber <= participantPageLimit; pageNumber += 1) {
		const response = await realtimeKitRequest<unknown[]>(
			config,
			"list-participants",
			`/meetings/${encodeURIComponent(input.meetingId)}/participants?page_no=${pageNumber}&per_page=${participantPageSize}`,
			{ method: "GET" },
		);
		const value = getEnvelopeValue(response.body);
		if (!Array.isArray(value)) {
			throw invalidResponse("list-participants", response);
		}
		for (const candidate of value) {
			if (
				!isRecord(candidate) ||
				candidate.custom_participant_id !== input.customParticipantId
			) {
				continue;
			}
			if (typeof candidate.id !== "string" || !candidate.id) {
				throw invalidResponse("list-participants", response);
			}
			return {
				customParticipantId: input.customParticipantId,
				name: typeof candidate.name === "string" ? candidate.name : undefined,
				participantId: candidate.id,
				picture: typeof candidate.picture === "string" ? candidate.picture : undefined,
				presetName:
					typeof candidate.preset_name === "string"
						? candidate.preset_name
						: undefined,
			};
		}
		seenCount += value.length;
		if (
			!shouldFetchNextParticipantPage({
				itemCount: value.length,
				pageNumber,
				paging: response.body.paging,
				resultInfo: response.body.result_info,
				seenCount,
			})
		) {
			return null;
		}
	}

	return null;
}
