import type { StudioEnv, StudioUser } from "../env";
import {
	getStudioContentPersonByGithub,
	getStudioContentVideo,
	type StudioContentPerson,
} from "./content";
import {
	addRealtimeKitParticipant,
	createRealtimeKitMeeting,
	getRealtimeKitConfig,
	type RealtimeKitRole,
} from "./realtimekit";
import {
	buildStudioSession,
	createInviteToken,
	createReadyMarker,
	createRecordingId,
	createStudioSessionId,
	createStudioInviteRecord,
	getStudioSession,
	getStudioUserGithubHandle,
	getStudioUserId,
	hashInviteToken,
	redeemStudioInvite,
	resolveStudioInvite,
	saveRecordingReadyMarker,
	saveStudioSessionRecordingStatus,
	saveStudioSession,
	upsertStudioParticipant,
	userCanManageStudioSession,
	userIsConfiguredStudioOperator,
type StudioInvite,
	type StudioRole,
} from "./studio";

export class StudioOperationError extends Error {
	readonly code:
		| "bad-request"
		| "content-unavailable"
		| "not-found"
		| "provider-not-configured"
		| "storage-not-configured"
		| "unauthorized";
	readonly status: number;

	constructor(
		code: StudioOperationError["code"],
		message: string,
		status: number,
	) {
		super(message);
		this.code = code;
		this.status = status;
	}
}

export interface CreateStudioSessionInput {
	show?: string;
	showId?: string;
	startsAt?: string;
	title?: string;
	videoId?: string;
}

export interface IssueParticipantTokenInput {
	inviteToken?: string;
	role: StudioRole;
	sessionId: string;
}

export interface CreateStudioInviteInput {
	expiresInHours?: number;
	maxUses?: number;
	role?: StudioRole;
	sessionId: string;
}

export interface MarkRecordingReadyInput {
	recordingId?: string;
	sessionId: string;
	sourceBucket?: string;
	sourceEtag: string;
	sourceFormat: "mkv" | "mp4" | "webm";
	sourceKey: string;
	videoId?: string;
}

export interface CreateRecordingUploadInput {
	sessionId: string;
	sourceFormat: "webm";
}

export interface UploadRecordingPartInput {
	body: ReadableStream;
	partNumber: number;
	recordingId: string;
	sessionId: string;
	sourceFormat: "webm";
	uploadId: string;
}

export interface CompleteRecordingUploadInput {
	parts: R2UploadedPart[];
	recordingId: string;
	sessionId: string;
	sourceFormat: "webm";
	uploadId: string;
}

export interface AbortRecordingUploadInput {
	recordingId: string;
	sessionId: string;
	sourceFormat: "webm";
	uploadId: string;
}

const recordingUploadPartSizeBytes = 8 * 1024 * 1024;
const recordingIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

function requireConfiguredRealtimeKit(env: StudioEnv) {
	const config = getRealtimeKitConfig(env);
	if (!config) {
		throw new StudioOperationError(
			"provider-not-configured",
			"RealtimeKit is not configured for this environment.",
			503,
		);
	}
	return config;
}

function requireRecordingsBucket(env: StudioEnv): R2Bucket {
	if (!env.RECORDINGS) {
		throw new StudioOperationError(
			"storage-not-configured",
			"RECORDINGS binding is required to store Studio recordings.",
			503,
		);
	}
	if (!env.RECORDINGS_BUCKET_NAME) {
		throw new StudioOperationError(
			"storage-not-configured",
			"RECORDINGS_BUCKET_NAME is required when RECORDINGS is bound.",
			503,
		);
	}
	return env.RECORDINGS;
}

function requireRecordingDatabase(env: StudioEnv): void {
	if (!env.STUDIO_DB) {
		throw new StudioOperationError(
			"storage-not-configured",
			"STUDIO_DB binding is required to persist Studio recording handoffs.",
			503,
		);
	}
}

function requirePersistentRecordingsBucket(env: StudioEnv): R2Bucket {
	requireRecordingDatabase(env);
	return requireRecordingsBucket(env);
}

function requireStudioDb(env: StudioEnv) {
	if (!env.STUDIO_DB) {
		throw new StudioOperationError(
			"storage-not-configured",
			"STUDIO_DB binding is required to persist Studio sessions.",
			503,
		);
	}
}

function assertRecordingId(recordingId: string): void {
	if (!recordingIdPattern.test(recordingId)) {
		throw new StudioOperationError(
			"bad-request",
			"Recording ID contains unsupported characters.",
			400,
		);
	}
}

function assertRecordingPartNumber(partNumber: number): void {
	if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) {
		throw new StudioOperationError(
			"bad-request",
			"Recording upload part number must be between 1 and 10000.",
			400,
		);
	}
}

function getRecordingContentType(_sourceFormat: "webm"): string {
	return "video/webm";
}

function getRecordingSourceKey(
	session: { recordingPrefix: string },
	recordingId: string,
	sourceFormat: "webm",
): string {
	assertRecordingId(recordingId);
	return `${session.recordingPrefix}${recordingId}/source.${sourceFormat}`;
}

function getSessionRecordingVideoId(session: {
	contentVideoId?: string | null;
	id: string;
	showId: string;
}): string {
	return session.contentVideoId ?? `${session.showId}/${session.id}`;
}

function requireContentBackedRecordingVideoId(session: {
	contentVideoId?: string | null;
}): string {
	if (!session.contentVideoId) {
		throw new StudioOperationError(
			"bad-request",
			"Studio recordings must be attached to a Rawkode content video before VOD handoff.",
			400,
		);
	}
	return session.contentVideoId;
}

async function getStudioParticipantProfile(
	env: StudioEnv,
	user: StudioUser,
): Promise<{
	githubHandle: string | null;
	name: string;
	participantId: string;
	person: StudioContentPerson | null;
	picture: string | null;
}> {
	const githubHandle = getStudioUserGithubHandle(user);
	const person = githubHandle
		? await getStudioContentPersonByGithub(env, githubHandle).catch(() => null)
		: null;
	const resolvedHandle = person?.githubHandle ?? githubHandle;

	return {
		githubHandle: resolvedHandle,
		name:
			person?.name ||
			user.name ||
			resolvedHandle ||
			"Studio participant",
		participantId: resolvedHandle ?? getStudioUserId(user),
		person,
		picture: person?.avatarUrl ?? user.image,
	};
}

async function requireSessionManager(
	env: StudioEnv,
	user: StudioUser,
	sessionId: string,
) {
	const session = await getStudioSession(env, sessionId);
	if (!session) {
		throw new StudioOperationError(
			"not-found",
			"Studio session was not found.",
			404,
		);
	}
	if (!(await userCanManageStudioSession(env, session, user))) {
		throw new StudioOperationError(
			"unauthorized",
			"Studio session management access is required.",
			403,
		);
	}
	return session;
}

export async function createStudioSession(
	env: StudioEnv,
	user: StudioUser,
	input: CreateStudioSessionInput,
) {
	requireStudioDb(env);
	if (!userIsConfiguredStudioOperator(env, user)) {
		throw new StudioOperationError(
			"unauthorized",
			"Studio operator access is required to create sessions.",
			403,
		);
	}
	const contentVideo = input.videoId
		? await getStudioContentVideo(env, input.videoId).catch((error: unknown) => {
				throw new StudioOperationError(
					"content-unavailable",
					error instanceof Error
						? error.message
						: "Rawkode content graph is unavailable.",
					502,
				);
			})
		: null;
	if (input.videoId && !contentVideo) {
		throw new StudioOperationError(
			"not-found",
			"Rawkode content video was not found.",
			404,
		);
	}
	const show = contentVideo?.show?.name ?? input.show;
	const showId = contentVideo?.show?.id ?? input.showId;
	const title = contentVideo?.title ?? input.title;
	const startsAt = contentVideo?.publishedAt ?? input.startsAt;
	if (!show || !title) {
		throw new StudioOperationError(
			"bad-request",
			"show and title are required when no content video is attached.",
			400,
		);
	}

	const sessionId = contentVideo
		? createStudioSessionId(contentVideo.id)
		: createStudioSessionId(show);
	const config = getRealtimeKitConfig(env);
	const meeting = config
		? await createRealtimeKitMeeting(config, {
				sessionId,
				title,
			})
		: null;
	const session = buildStudioSession({
		contentVideoId: contentVideo?.id ?? null,
		contentVideoSlug: contentVideo?.slug ?? null,
		createdBy: user,
		guests: contentVideo?.guests,
		hosts: contentVideo?.show?.hosts,
		meeting,
		sessionId,
		show,
		showId,
		startsAt,
		title,
	});
	await saveStudioSession(env, session);
	await upsertStudioParticipant(env, {
		sessionId: session.id,
		user,
		role: "host",
	});

	return {
		session,
		meeting,
		provider: "realtimekit" as const,
		status: meeting ? "ready" : "provider-not-configured",
	};
}

export async function createStudioInvite(
	env: StudioEnv,
	user: StudioUser,
	input: CreateStudioInviteInput,
) {
	requireStudioDb(env);
	const role = input.role ?? "guest";
	if (role !== "guest") {
		throw new StudioOperationError(
			"bad-request",
			"Only guest invites can be created through this endpoint.",
			400,
		);
	}
	const session = await requireSessionManager(env, user, input.sessionId);
	const token = createInviteToken();
	const tokenHash = await hashInviteToken(token);
	const expiresInHours = Math.min(
		Math.max(input.expiresInHours ?? 72, 1),
		24 * 30,
	);
	const invite = await createStudioInviteRecord(env, {
		createdBy: user,
		expiresAt: Math.floor(Date.now() / 1000) + expiresInHours * 60 * 60,
		maxUses: Math.min(Math.max(input.maxUses ?? 1, 1), 25),
		role,
		sessionId: session.id,
		tokenHash,
	});

	return {
		invite,
		inviteToken: token,
		inviteUrl: `/guest/${token}`,
		session,
	};
}

export async function issueStudioParticipantToken(
	env: StudioEnv,
	user: StudioUser,
	input: IssueParticipantTokenInput,
) {
	const session = await getStudioSession(env, input.sessionId);
	if (!session) {
		throw new StudioOperationError(
			"not-found",
			"Studio session was not found.",
			404,
		);
	}
	let inviteToRedeem: StudioInvite | null = null;
	const canManage = await userCanManageStudioSession(env, session, user);
	if (input.role === "guest") {
		if (!canManage) {
			if (!input.inviteToken) {
				throw new StudioOperationError(
					"unauthorized",
					"Guest invite token is required to join this Studio session.",
					403,
				);
			}
			const resolvedInvite = await resolveStudioInvite(env, input.inviteToken, user);
			if (
				!resolvedInvite ||
				resolvedInvite.session.id !== session.id ||
				resolvedInvite.invite.role !== "guest"
			) {
				throw new StudioOperationError(
					"unauthorized",
					"Guest invite token is invalid or expired.",
					403,
				);
			}
			inviteToRedeem = resolvedInvite.invite;
		}
	} else if (!canManage) {
		throw new StudioOperationError(
			"unauthorized",
			"Studio session management access is required for this role.",
			403,
		);
	}
	if (!session.realtimeKitMeetingId) {
		throw new StudioOperationError(
			"provider-not-configured",
			"RealtimeKit meeting has not been created for this session.",
			503,
		);
	}

	const config = requireConfiguredRealtimeKit(env);
	if (inviteToRedeem) {
		const redeemed = await redeemStudioInvite(env, inviteToRedeem, user);
		if (!redeemed) {
			throw new StudioOperationError(
				"unauthorized",
				"Guest invite token is no longer available.",
				403,
			);
		}
	}
	const profile = await getStudioParticipantProfile(env, user);
	const participant = await addRealtimeKitParticipant(config, {
		meetingId: session.realtimeKitMeetingId,
		participantId: profile.participantId,
		role: input.role as RealtimeKitRole,
		name: profile.name,
		picture: profile.picture,
	});
	await upsertStudioParticipant(env, {
		person: profile.person
			? {
					avatarUrl: profile.person.avatarUrl,
					githubHandle: profile.githubHandle,
					id: profile.participantId,
					name: profile.name,
				}
			: null,
		sessionId: session.id,
		user,
		role: input.role,
	});
	return {
		...participant,
		meetingId: session.realtimeKitMeetingId,
		sessionId: session.id,
	};
}

export async function createStudioRecordingUpload(
	env: StudioEnv,
	user: StudioUser,
	input: CreateRecordingUploadInput,
) {
	const session = await requireSessionManager(env, user, input.sessionId);
	const bucket = requirePersistentRecordingsBucket(env);
	const videoId = requireContentBackedRecordingVideoId(session);
	const recordingId = createRecordingId();
	const sourceKey = getRecordingSourceKey(
		session,
		recordingId,
		input.sourceFormat,
	);
	const upload = await bucket.createMultipartUpload(sourceKey, {
		httpMetadata: { contentType: getRecordingContentType(input.sourceFormat) },
		customMetadata: {
			recordingId,
			sessionId: session.id,
			videoId,
		},
	});
	try {
		await saveStudioSessionRecordingStatus(env, session.id, "recording");
	} catch (error) {
		await upload.abort().catch(() => undefined);
		throw error;
	}

	return {
		partSizeBytes: recordingUploadPartSizeBytes,
		recordingId,
		sessionId: session.id,
		sourceFormat: input.sourceFormat,
		sourceKey,
		uploadId: upload.uploadId,
	};
}

export async function uploadStudioRecordingPart(
	env: StudioEnv,
	user: StudioUser,
	input: UploadRecordingPartInput,
) {
	const session = await requireSessionManager(env, user, input.sessionId);
	const bucket = requirePersistentRecordingsBucket(env);
	assertRecordingPartNumber(input.partNumber);
	const sourceKey = getRecordingSourceKey(
		session,
		input.recordingId,
		input.sourceFormat,
	);
	requireContentBackedRecordingVideoId(session);
	const upload = bucket.resumeMultipartUpload(sourceKey, input.uploadId);
	const part = await upload.uploadPart(input.partNumber, input.body);

	return {
		partNumber: part.partNumber,
		etag: part.etag,
	};
}

export async function completeStudioRecordingUpload(
	env: StudioEnv,
	user: StudioUser,
	input: CompleteRecordingUploadInput,
) {
	const session = await requireSessionManager(env, user, input.sessionId);
	const bucket = requirePersistentRecordingsBucket(env);
	const sourceKey = getRecordingSourceKey(
		session,
		input.recordingId,
		input.sourceFormat,
	);
	const parts = [...input.parts].sort((left, right) => left.partNumber - right.partNumber);
	if (parts.length === 0) {
		throw new StudioOperationError(
			"bad-request",
			"At least one recording upload part is required.",
			400,
		);
	}
	for (const part of parts) {
		assertRecordingPartNumber(part.partNumber);
		if (!part.etag) {
			throw new StudioOperationError(
				"bad-request",
				"Each recording upload part must include an ETag.",
				400,
			);
		}
	}

	const videoId = requireContentBackedRecordingVideoId(session);
	const upload = bucket.resumeMultipartUpload(sourceKey, input.uploadId);
	const source = await upload.complete(parts);

	return await markStudioRecordingReady(env, user, {
		recordingId: input.recordingId,
		sessionId: session.id,
		sourceEtag: source.etag,
		sourceFormat: input.sourceFormat,
		sourceKey,
		videoId,
	});
}

export async function abortStudioRecordingUpload(
	env: StudioEnv,
	user: StudioUser,
	input: AbortRecordingUploadInput,
) {
	const session = await requireSessionManager(env, user, input.sessionId);
	const bucket = requirePersistentRecordingsBucket(env);
	const sourceKey = getRecordingSourceKey(
		session,
		input.recordingId,
		input.sourceFormat,
	);
	const upload = bucket.resumeMultipartUpload(sourceKey, input.uploadId);
	await upload.abort();
	await saveStudioSessionRecordingStatus(env, session.id, "idle");

	return {
		recordingId: input.recordingId,
		sessionId: session.id,
		sourceKey,
		aborted: true,
	};
}

export async function markStudioRecordingReady(
	env: StudioEnv,
	user: StudioUser,
	input: MarkRecordingReadyInput,
) {
	const session = await requireSessionManager(env, user, input.sessionId);
	if (env.STUDIO_DB && !env.RECORDINGS) {
		throw new StudioOperationError(
			"storage-not-configured",
			"RECORDINGS binding is required to publish Studio recording ready markers.",
			503,
		);
	}
	if (env.RECORDINGS && !env.STUDIO_DB) {
		throw new StudioOperationError(
			"storage-not-configured",
			"STUDIO_DB binding is required to persist Studio recording handoffs.",
			503,
		);
	}
	const persistentHandoff = Boolean(env.RECORDINGS && env.STUDIO_DB);
	const recordingId = input.recordingId ?? createRecordingId();
	assertRecordingId(recordingId);

	if (!input.sourceKey.startsWith(session.recordingPrefix)) {
		throw new StudioOperationError(
			"bad-request",
			`Recording source key must be under ${session.recordingPrefix}.`,
			400,
		);
	}
	if (persistentHandoff && !env.RECORDINGS_BUCKET_NAME) {
		throw new StudioOperationError(
			"storage-not-configured",
			"RECORDINGS_BUCKET_NAME is required when RECORDINGS is bound.",
			503,
		);
	}
	const videoId = persistentHandoff
		? requireContentBackedRecordingVideoId(session)
		: getSessionRecordingVideoId(session);
	const sourceBucket = env.RECORDINGS_BUCKET_NAME ?? input.sourceBucket;
	if (!sourceBucket) {
		throw new StudioOperationError(
			"bad-request",
			"Recording source bucket is required.",
			400,
		);
	}

	const marker = createReadyMarker({
		videoId,
		studioSessionId: input.sessionId,
		recordingId,
		sourceBucket,
		sourceKey: input.sourceKey,
		sourceEtag: input.sourceEtag,
		sourceFormat: input.sourceFormat,
	});
	const handoff = await saveRecordingReadyMarker(env, marker);

	return { ...marker, ...handoff };
}
