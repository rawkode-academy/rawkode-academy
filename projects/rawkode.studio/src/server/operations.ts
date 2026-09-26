import type { StudioEnv, StudioUser } from "../env";
import type { SendSubjectInput } from "notifications/src/contracts.js";
import {
	cloudflareStreamLiveInputIsConnected,
	createCloudflareStreamLiveInput,
	getCloudflareStreamConfig,
	getCloudflareStreamLiveInput,
	type CloudflareStreamConfig,
	type CloudflareStreamLiveInput,
} from "./cloudflare-stream";
import {
	getStudioContentPersonByGithub,
	getStudioContentVideo,
	type StudioContentPerson,
} from "./content";
import {
	addRealtimeKitParticipant,
	createLegacyRealtimeKitCustomParticipantId,
	createRealtimeKitCustomParticipantId,
	createRealtimeKitMeeting,
	endRealtimeKitSession,
	findRealtimeKitParticipantByCustomId,
	getRealtimeKitConfig,
	RealtimeKitProviderError,
	refreshRealtimeKitParticipantToken,
	type RealtimeKitConfig,
	type RealtimeKitParticipantToken,
	type RealtimeKitRole,
} from "./realtimekit";
import {
	buildStudioSession,
	claimStudioRecordingLease,
	claimStudioStreamStart,
	claimStudioStreamNotification,
	createInviteToken,
	createReadyMarker,
	createRecordingId,
	createStudioSessionId,
	createStudioInviteRecord,
	expireStaleStudioRecordingLeases,
	expireStaleStudioStreams,
	getStudioParticipantProviderIdentity,
	getStudioSession,
	getStudioStreamLease,
	getStudioUserGithubHandle,
	getStudioUserId,
	hasCanonicalStudioVodOutput,
	hasFreshStudioContentStreamConflict,
	hasCanonicalStudioRecording,
	hashInviteToken,
	isStudioSessionActive,
	redeemStudioInvite,
	releaseStudioRecordingLease,
	releaseStudioStreamNotificationClaim,
	renewStudioRecordingLease,
	resolveStudioInvite,
	saveRecordingReadyMarker,
	saveStudioSessionStatus,
	saveStudioSession,
	saveStudioStreamEnded,
	saveStudioStreamHeartbeat,
	saveStudioStreamLive,
	saveStudioStreamStart,
	takeOverStudioStreamLease,
	upsertStudioParticipant,
	userCanManageStudioSession,
	userCanJoinStudioSessionAsGuest,
	userIsConfiguredStudioOperator,
	type StudioInvite,
	type StudioRecordingReadyMarker,
	StudioRecordingOutputClaimedError,
	type StudioSessionRecord,
	type StudioRole,
	type StreamEnvironment,
	studioRecordingHeartbeatIntervalMs,
	studioRecordingLeaseTimeoutSeconds,
} from "./studio";

export class StudioOperationError extends Error {
	readonly code:
		| "bad-request"
		| "content-unavailable"
		| "content-stream-active"
		| "not-found"
		| "provider-failed"
		| "provider-not-configured"
		| "recording-active"
		| "recording-output-claimed"
		| "session-ended"
		| "storage-not-configured"
		| "stream-active"
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
	streamEnvironment?: StreamEnvironment;
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

export interface EndStudioSessionInput {
	sessionId: string;
}

export interface StudioStreamInput {
	sessionId: string;
	streamToken?: string;
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

export interface StudioRecordingHeartbeatInput {
	recordingId: string;
	sessionId: string;
}

export type StudioRecordingHandoff = StudioRecordingReadyMarker & {
	readyMarkerKey: string;
	sourceVerified: boolean;
};

export type AbortStudioRecordingUploadResult =
	| {
			aborted: true;
			handoff: null;
			leaseReleased: boolean;
			outcome: "aborted";
			recordingId: string;
			recovered: false;
			sessionId: string;
			sourceKey: string;
	  }
	| {
			aborted: false;
			handoff: StudioRecordingHandoff;
			leaseReleased: boolean;
			outcome: "recovered";
			recordingId: string;
			recovered: true;
			sessionId: string;
			sourceKey: string;
	  };

const recordingUploadPartSizeBytes = 8 * 1024 * 1024;
const recordingIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

async function loadRealtimeKitConfig(
	env: StudioEnv,
): Promise<RealtimeKitConfig | null> {
	try {
		return await getRealtimeKitConfig(env);
	} catch {
		throw new StudioOperationError(
			"provider-failed",
			"RealtimeKit configuration could not be loaded.",
			502,
		);
	}
}

async function requireConfiguredRealtimeKit(env: StudioEnv) {
	const config = await loadRealtimeKitConfig(env);
	if (!config) {
		throw new StudioOperationError(
			"provider-not-configured",
			"RealtimeKit is not configured for this environment.",
			503,
		);
	}
	return config;
}

function toStudioRealtimeKitError(error: unknown): unknown {
	return error instanceof RealtimeKitProviderError
		? new StudioOperationError("provider-failed", error.message, 502)
		: error;
}

async function runRealtimeKitOperation<T>(operation: () => Promise<T>): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		throw toStudioRealtimeKitError(error);
	}
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

async function requireConfiguredCloudflareStream(
	env: StudioEnv,
): Promise<CloudflareStreamConfig> {
	const config = await getCloudflareStreamConfig(env);
	if (!config) {
		throw new StudioOperationError(
			"provider-not-configured",
			"Cloudflare Stream is not configured for this environment.",
			503,
		);
	}
	return config;
}

function requireNotificationsQueue(env: StudioEnv): Queue<SendSubjectInput> {
	if (!env.STREAM_NOTIFICATIONS) {
		throw new StudioOperationError(
			"provider-not-configured",
			"STREAM_NOTIFICATIONS queue binding is required for prod stream notifications.",
			503,
		);
	}
	return env.STREAM_NOTIFICATIONS;
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

async function requireStudioRecordingLease(
	env: StudioEnv,
	sessionId: string,
	recordingId: string,
): Promise<void> {
	const renewed = await renewStudioRecordingLease(env, sessionId, recordingId);
	if (!renewed) {
		throw new StudioOperationError(
			"recording-active",
			"Another Studio recording is already active for this session.",
			409,
		);
	}
}

async function requireStudioRecordingLeaseOrCompletedRecovery(
	env: StudioEnv,
	sessionId: string,
	recordingId: string,
): Promise<void> {
	if (await renewStudioRecordingLease(env, sessionId, recordingId)) return;
	await expireStaleStudioRecordingLeases(env, sessionId);
	if (await claimStudioRecordingLease(env, sessionId, recordingId)) return;
	throw new StudioOperationError(
		"recording-active",
		"Another Studio recording is already active for this session.",
		409,
	);
}

function requireRecordingSourceEtag(source: R2Object): string {
	if (!source.etag) {
		throw new StudioOperationError(
			"storage-not-configured",
			"Completed Studio recording source is missing its R2 ETag.",
			503,
		);
	}
	return source.etag;
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

function requireProdRecordingSession(session: {
	streamEnvironment: StreamEnvironment;
}): void {
	if (session.streamEnvironment !== "prod") {
		throw new StudioOperationError(
			"bad-request",
			"Test-mode Studio recordings stay local and cannot use persistent recording handoff.",
			400,
		);
	}
}

function requireContentBackedStreamSession(session: {
	contentVideoId?: string | null;
	contentVideoSlug?: string | null;
}): { contentVideoId: string; contentVideoSlug: string } {
	if (!session.contentVideoId || !session.contentVideoSlug) {
		throw new StudioOperationError(
			"bad-request",
			"Prod streams must be attached to a Rawkode content video before going live.",
			400,
		);
	}
	return {
		contentVideoId: session.contentVideoId,
		contentVideoSlug: session.contentVideoSlug,
	};
}

function requireStreamPublishUrls(liveInput: CloudflareStreamLiveInput): {
	playbackUrl: string;
	publishUrl: string;
} {
	const publishUrl = liveInput.webRTC?.url;
	const playbackUrl = liveInput.webRTCPlayback?.url;
	if (!liveInput.uid || !publishUrl || !playbackUrl) {
		throw new StudioOperationError(
			"provider-not-configured",
			"Cloudflare Stream live input did not include WebRTC publish and playback URLs.",
			503,
		);
	}
	return { playbackUrl, publishUrl };
}

function nowSeconds(): number {
	return Math.floor(Date.now() / 1000);
}

function buildStreamNotification(
	session: {
		cloudflareStreamLiveInputId?: string | null;
		contentVideoId?: string | null;
		contentVideoSlug?: string | null;
		id: string;
		title: string;
	},
): SendSubjectInput {
	const { contentVideoId, contentVideoSlug } = requireContentBackedStreamSession(
		session,
	);
	return {
		subjectKey: `stream:${contentVideoSlug}`,
		title: `${session.title} is live`,
		body: "The stream has started on Rawkode Academy.",
		url: `https://rawkode.academy/watch/${contentVideoSlug}`,
		tag: `stream:${contentVideoSlug}`,
		data: {
			cloudflareStreamLiveInputId: session.cloudflareStreamLiveInputId,
			studioSessionId: session.id,
			videoId: contentVideoId,
			videoSlug: contentVideoSlug,
		},
	};
}

async function notifyStudioStreamIfNeeded(
	env: StudioEnv,
	session: Pick<
		StudioSessionRecord,
		| "cloudflareStreamLiveInputId"
		| "contentVideoId"
		| "contentVideoSlug"
		| "id"
		| "streamEnvironment"
		| "streamNotificationQueuedAt"
		| "title"
	>,
): Promise<boolean> {
	if (
		session.streamEnvironment !== "prod" ||
		session.streamNotificationQueuedAt !== null
	) {
		return false;
	}

	requireContentBackedStreamSession(session);
	const notificationQueuedAt = nowSeconds();
	const claimed = await claimStudioStreamNotification(
		env,
		session.id,
		notificationQueuedAt,
	);
	if (!claimed) {
		return false;
	}

	try {
		await requireNotificationsQueue(env).send(buildStreamNotification(session));
		return true;
	} catch (error) {
		await releaseStudioStreamNotificationClaim(
			env,
			session.id,
			notificationQueuedAt,
		).catch(() => undefined);
		throw error;
	}
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

async function issueRealtimeKitParticipantToken(
	env: StudioEnv,
	config: RealtimeKitConfig,
	input: {
		meetingId: string;
		profile: Awaited<ReturnType<typeof getStudioParticipantProfile>>;
		role: RealtimeKitRole;
		sessionId: string;
		user: StudioUser;
	},
): Promise<RealtimeKitParticipantToken> {
	const stableParticipantId = getStudioUserId(input.user);
	const customParticipantIds = [
		await createRealtimeKitCustomParticipantId({
			meetingId: input.meetingId,
			participantId: stableParticipantId,
			role: input.role,
		}),
		createLegacyRealtimeKitCustomParticipantId({
			participantId: input.profile.participantId,
			role: input.role,
		}),
	];

	const persistParticipant = async (realtimeKitParticipantId: string) => {
		await upsertStudioParticipant(env, {
			person: input.profile.person
				? {
						avatarUrl: input.profile.person.avatarUrl,
						githubHandle: input.profile.githubHandle,
						id: input.profile.participantId,
						name: input.profile.name,
					}
				: null,
			realtimeKitParticipantId,
			role: input.role,
			sessionId: input.sessionId,
			user: input.user,
		});
	};
	const refreshParticipant = (realtimeKitParticipantId: string) =>
		runRealtimeKitOperation(() =>
			refreshRealtimeKitParticipantToken(config, {
				meetingId: input.meetingId,
				realtimeKitParticipantId,
			}),
		);
	const findExistingParticipant = async () => {
		for (const customParticipantId of customParticipantIds) {
			const participant = await findRealtimeKitParticipantByCustomId(config, {
				customParticipantId,
				meetingId: input.meetingId,
			});
			if (participant) return participant;
		}
		return null;
	};

	const storedIdentity = await getStudioParticipantProviderIdentity(env, {
		role: input.role,
		sessionId: input.sessionId,
		user: input.user,
	});
	if (storedIdentity?.realtimeKitParticipantId) {
		try {
			const participant = await refreshRealtimeKitParticipantToken(config, {
				meetingId: input.meetingId,
				realtimeKitParticipantId: storedIdentity.realtimeKitParticipantId,
			});
			await persistParticipant(participant.participantId);
			return participant;
		} catch (error) {
			if (!(error instanceof RealtimeKitProviderError && error.httpStatus === 404)) {
				throw toStudioRealtimeKitError(error);
			}
		}
	}

	const existingParticipant = await runRealtimeKitOperation(findExistingParticipant);
	if (existingParticipant) {
		await persistParticipant(existingParticipant.participantId);
		return refreshParticipant(existingParticipant.participantId);
	}

	let participant: RealtimeKitParticipantToken;
	try {
		participant = await addRealtimeKitParticipant(config, {
			meetingId: input.meetingId,
			name: input.profile.name,
			participantId: stableParticipantId,
			picture: input.profile.picture,
			role: input.role,
		});
	} catch (addError) {
		let recoveredParticipant;
		try {
			recoveredParticipant = await findExistingParticipant();
		} catch (lookupError) {
			throw toStudioRealtimeKitError(lookupError);
		}
		if (!recoveredParticipant) {
			throw toStudioRealtimeKitError(addError);
		}
		await persistParticipant(recoveredParticipant.participantId);
		return refreshParticipant(recoveredParticipant.participantId);
	}

	await persistParticipant(participant.participantId);
	return participant;
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
	const config = await loadRealtimeKitConfig(env);
	const meeting = config
		? await runRealtimeKitOperation(() =>
				createRealtimeKitMeeting(config, {
					sessionId,
					title,
				}),
			)
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
		status: "scheduled",
		streamEnvironment: input.streamEnvironment === "prod" ? "prod" : "test",
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

export async function startStudioStream(
	env: StudioEnv,
	user: StudioUser,
	input: StudioStreamInput,
) {
	requireStudioDb(env);
	await expireStaleStudioStreams(env, input.sessionId);
	const session = await requireSessionManager(env, user, input.sessionId);
	if (session.status === "complete") {
		throw new StudioOperationError(
			"session-ended",
			"Studio session has ended.",
			409,
		);
	}
	if (session.streamStatus === "live" || session.streamStatus === "starting") {
		throw new StudioOperationError(
			"stream-active",
			"Studio stream is already active.",
			409,
		);
	}
	if (session.streamEnvironment === "prod") {
		requireContentBackedStreamSession(session);
	}
	const streamToken = input.streamToken === undefined
		? crypto.randomUUID()
		: normalizeStudioStreamToken(input.streamToken, "start Studio stream publishing");
	const claimed = await claimStudioStreamStart(env, session.id, streamToken);
	if (!claimed) {
		if (
			session.streamEnvironment === "prod" &&
			await hasFreshStudioContentStreamConflict(env, session.id)
		) {
			throw new StudioOperationError(
				"content-stream-active",
				"Another prod Studio session is already publishing this content.",
				409,
			);
		}
		throw new StudioOperationError(
			"stream-active",
			"Studio stream is already active.",
			409,
		);
	}

	try {
		const config = await requireConfiguredCloudflareStream(env);
		const liveInput = session.cloudflareStreamLiveInputId
			? await getCloudflareStreamLiveInput(config, session.cloudflareStreamLiveInputId)
			: await createCloudflareStreamLiveInput(config, {
					contentVideoSlug: session.contentVideoSlug,
					name: session.title,
					sessionId: session.id,
					streamEnvironment: session.streamEnvironment,
				});
		const { playbackUrl, publishUrl } = requireStreamPublishUrls(liveInput);
		const saved = await saveStudioStreamStart(env, {
			liveInputId: liveInput.uid,
			playbackUrl,
			sessionId: session.id,
			startToken: streamToken,
		});
		if (!saved) {
			throw new StudioOperationError(
				"bad-request",
				"Studio stream is no longer starting.",
				409,
			);
		}

		return {
			sessionId: session.id,
			streamStatus: "starting" as const,
			liveInputId: liveInput.uid,
			publishUrl,
			playbackUrl,
			streamToken,
		};
	} catch (error) {
		await saveStudioStreamEnded(env, session.id, streamToken).catch(() => undefined);
		throw error;
	}
}

export async function heartbeatStudioStream(
	env: StudioEnv,
	user: StudioUser,
	input: StudioStreamInput,
) {
	requireStudioDb(env);
	await requireSessionManager(env, user, input.sessionId);
	const streamToken = requireStudioStreamToken(
		input.streamToken,
		"renew Studio stream publishing",
	);

	const renewed = await saveStudioStreamHeartbeat(
		env,
		input.sessionId,
		streamToken,
	);
	if (!renewed) {
		throw new StudioOperationError(
			"stream-active",
			"Studio stream publisher lease is no longer active.",
			409,
		);
	}

	return {
		sessionId: input.sessionId,
		leaseStatus: "active" as const,
	};
}

export async function takeOverStudioStream(
	env: StudioEnv,
	user: StudioUser,
	input: StudioStreamInput,
) {
	requireStudioDb(env);
	const session = await requireSessionManager(env, user, input.sessionId);
	if (session.status === "complete") {
		throw new StudioOperationError(
			"session-ended",
			"Studio session has ended.",
			409,
		);
	}

	const lease = await getStudioStreamLease(env, session.id);
	if (lease && (lease.status === "starting" || lease.status === "live")) {
		const takenOver = await takeOverStudioStreamLease(env, session.id, lease);
		if (!takenOver) {
			throw new StudioOperationError(
				"stream-active",
				"Studio stream publisher changed while takeover was in progress. Try again.",
				409,
			);
		}
	}
	return {
		sessionId: session.id,
		streamStatus: "ended" as const,
	};
}

export async function confirmStudioStream(
	env: StudioEnv,
	user: StudioUser,
	input: StudioStreamInput,
) {
	requireStudioDb(env);
	const session = await requireSessionManager(env, user, input.sessionId);
	const streamToken = requireStudioStreamToken(
		input.streamToken,
		"confirm Studio stream publishing",
	);
	if (!session.cloudflareStreamLiveInputId) {
		throw new StudioOperationError(
			"bad-request",
			"Studio stream has not been started for this session.",
			400,
		);
	}
	if (session.status === "complete") {
		throw new StudioOperationError(
			"session-ended",
			"Studio session has ended.",
			409,
		);
	}
	if (session.streamStatus === "live") {
		const ownsLease = await saveStudioStreamHeartbeat(env, session.id, streamToken);
		if (!ownsLease) {
			throw new StudioOperationError(
				"stream-active",
				"Studio stream publisher lease is no longer active.",
				409,
			);
		}
		return {
			sessionId: session.id,
			streamStatus: "live" as const,
			notified: await notifyStudioStreamIfNeeded(env, session),
		};
	}
	if (session.streamStatus !== "starting") {
		throw new StudioOperationError(
			"bad-request",
			"Studio stream is not waiting for live confirmation.",
			409,
		);
	}

	const config = await requireConfiguredCloudflareStream(env);
	const liveInput = await getCloudflareStreamLiveInput(
		config,
		session.cloudflareStreamLiveInputId,
	);
	if (!cloudflareStreamLiveInputIsConnected(liveInput)) {
		throw new StudioOperationError(
			"bad-request",
			"Cloudflare Stream live input is not connected yet.",
			409,
		);
	}
	const playbackUrl =
		liveInput.webRTCPlayback?.url ?? session.cloudflareStreamPlaybackUrl;
	if (!playbackUrl) {
		throw new StudioOperationError(
			"provider-not-configured",
			"Cloudflare Stream live input did not include a WebRTC playback URL.",
			503,
		);
	}

	const savedLive = await saveStudioStreamLive(env, {
		playbackUrl,
		publicLive: session.streamEnvironment === "prod",
		sessionId: session.id,
		startToken: streamToken,
	});
	if (!savedLive) {
		const latest = await getStudioSession(env, session.id);
		const ownsLiveLease = latest?.streamStatus === "live" &&
			await saveStudioStreamHeartbeat(env, session.id, streamToken);
		if (latest?.streamStatus === "live" && ownsLiveLease) {
			return {
				sessionId: session.id,
				streamStatus: "live" as const,
				notified: await notifyStudioStreamIfNeeded(env, latest),
			};
		}
		throw new StudioOperationError(
			"bad-request",
			"Studio stream is no longer waiting for live confirmation.",
			409,
		);
	}

	const notified = await notifyStudioStreamIfNeeded(env, session);

	return {
		sessionId: session.id,
		streamStatus: "live" as const,
		notified,
	};
}

export async function stopStudioStream(
	env: StudioEnv,
	user: StudioUser,
	input: StudioStreamInput,
) {
	requireStudioDb(env);
	const session = await requireSessionManager(env, user, input.sessionId);
	const streamToken = requireStudioStreamToken(
		input.streamToken,
		"stop Studio stream publishing",
	);
	const stopped = await saveStudioStreamEnded(env, session.id, streamToken);
	if (!stopped) {
		throw new StudioOperationError(
			"stream-active",
			"Studio stream publisher lease is no longer active.",
			409,
		);
	}

	return {
		sessionId: session.id,
		streamStatus: "ended" as const,
	};
}

function requireStudioStreamToken(value: unknown, action: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new StudioOperationError(
			"bad-request",
			`streamToken is required to ${action}.`,
			400,
		);
	}
	return normalizeStudioStreamToken(value, action);
}

function normalizeStudioStreamToken(value: unknown, action: string): string {
	if (typeof value !== "string") {
		throw new StudioOperationError(
			"bad-request",
			`streamToken must be a string to ${action}.`,
			400,
		);
	}
	const token = value.trim();
	if (token.length === 0 || token.length > 256) {
		throw new StudioOperationError(
			"bad-request",
			`streamToken is invalid for ${action}.`,
			400,
		);
	}
	return token;
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

export async function endStudioSession(
	env: StudioEnv,
	user: StudioUser,
	input: EndStudioSessionInput,
) {
	const session = await requireSessionManager(env, user, input.sessionId);
	const meetingId = session.realtimeKitMeetingId;
	await expireStaleStudioRecordingLeases(env, session.id);
	if (!(await saveStudioSessionStatus(env, session.id, "complete"))) {
		throw new StudioOperationError(
			"recording-active",
			"Stop the active Studio recording before ending this session.",
			409,
		);
	}
	await saveStudioStreamEnded(env, session.id);
	if (meetingId) {
		const config = await requireConfiguredRealtimeKit(env);
		await runRealtimeKitOperation(() =>
			endRealtimeKitSession(config, meetingId),
		);
	}

	return {
		sessionId: session.id,
		status: "complete" as const,
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
				if (!userCanJoinStudioSessionAsGuest(session, user)) {
					throw new StudioOperationError(
						"unauthorized",
						"Guest invite token is required to join this Studio session.",
						403,
					);
				}
			} else {
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
	if (!isStudioSessionActive(session)) {
		throw new StudioOperationError(
			"session-ended",
			"Studio session has ended.",
			409,
		);
	}

	const config = await requireConfiguredRealtimeKit(env);
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
	const participant = await issueRealtimeKitParticipantToken(env, config, {
		meetingId: session.realtimeKitMeetingId,
		role: input.role,
		profile,
		sessionId: session.id,
		user,
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
	requireProdRecordingSession(session);
	const bucket = requirePersistentRecordingsBucket(env);
	const videoId = requireContentBackedRecordingVideoId(session);
	if (await hasCanonicalStudioVodOutput(env, videoId)) {
		throw new StudioOperationError(
			"recording-output-claimed",
			"A canonical VOD output already exists for this content video.",
			409,
		);
	}
	await expireStaleStudioRecordingLeases(env, session.id);
	const recordingId = createRecordingId();
	const sourceKey = getRecordingSourceKey(
		session,
		recordingId,
		input.sourceFormat,
	);
	const claimed = await claimStudioRecordingLease(env, session.id, recordingId);
	if (!claimed) {
		if (await hasCanonicalStudioRecording(env, session.id)) {
			throw new StudioOperationError(
				"recording-output-claimed",
				"A canonical Studio recording already exists for this content video.",
				409,
			);
		}
		throw new StudioOperationError(
			"recording-active",
			"Another Studio recording is already active for this content video.",
			409,
		);
	}

	let upload: R2MultipartUpload;
	try {
		upload = await bucket.createMultipartUpload(sourceKey, {
			httpMetadata: { contentType: getRecordingContentType(input.sourceFormat) },
			customMetadata: {
				recordingId,
				sessionId: session.id,
				videoId,
			},
		});
	} catch (error) {
		await releaseStudioRecordingLease(env, {
			nextStatus: "idle",
			recordingId,
			sessionId: session.id,
		}).catch(() => false);
		throw error;
	}

	return {
		heartbeatIntervalMs: studioRecordingHeartbeatIntervalMs,
		leaseTimeoutSeconds: studioRecordingLeaseTimeoutSeconds,
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
	requireProdRecordingSession(session);
	const bucket = requirePersistentRecordingsBucket(env);
	assertRecordingPartNumber(input.partNumber);
	const sourceKey = getRecordingSourceKey(
		session,
		input.recordingId,
		input.sourceFormat,
	);
	requireContentBackedRecordingVideoId(session);
	await requireStudioRecordingLease(env, session.id, input.recordingId);
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
	requireProdRecordingSession(session);
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
	let completionRecovered = false;
	let source = await bucket.head(sourceKey);
	if (source) {
		await requireStudioRecordingLeaseOrCompletedRecovery(
			env,
			session.id,
			input.recordingId,
		);
		completionRecovered = true;
	} else {
		await requireStudioRecordingLease(env, session.id, input.recordingId);
		try {
			const upload = bucket.resumeMultipartUpload(sourceKey, input.uploadId);
			source = await upload.complete(parts);
		} catch (completionError) {
			const completedSource = await bucket.head(sourceKey).catch(() => null);
			if (!completedSource) throw completionError;
			source = completedSource;
			completionRecovered = true;
		}
	}

	const handoff = await markStudioRecordingReady(env, user, {
		recordingId: input.recordingId,
		sessionId: session.id,
		sourceEtag: requireRecordingSourceEtag(source),
		sourceFormat: input.sourceFormat,
		sourceKey,
		videoId,
	});
	const leaseReleased = await releaseStudioRecordingLease(env, {
		nextStatus: "uploaded",
		recordingId: input.recordingId,
		sessionId: session.id,
	});

	return { ...handoff, completionRecovered, leaseReleased };
}

export async function abortStudioRecordingUpload(
	env: StudioEnv,
	user: StudioUser,
	input: AbortRecordingUploadInput,
): Promise<AbortStudioRecordingUploadResult> {
	const session = await requireSessionManager(env, user, input.sessionId);
	requireProdRecordingSession(session);
	const bucket = requirePersistentRecordingsBucket(env);
	const sourceKey = getRecordingSourceKey(
		session,
		input.recordingId,
		input.sourceFormat,
	);
	const videoId = requireContentBackedRecordingVideoId(session);

	const recoverCompletedSource = async (
		source: R2Object,
	): Promise<AbortStudioRecordingUploadResult> => {
		const handoff = await markStudioRecordingReady(env, user, {
			recordingId: input.recordingId,
			sessionId: session.id,
			sourceEtag: requireRecordingSourceEtag(source),
			sourceFormat: input.sourceFormat,
			sourceKey,
			videoId,
		});
		const leaseReleased = await releaseStudioRecordingLease(env, {
			nextStatus: "uploaded",
			recordingId: input.recordingId,
			sessionId: session.id,
		});
		return {
			aborted: false,
			handoff,
			leaseReleased,
			outcome: "recovered",
			recordingId: input.recordingId,
			recovered: true,
			sessionId: session.id,
			sourceKey,
		};
	};

	const completedSource = await bucket.head(sourceKey);
	if (completedSource) {
		await requireStudioRecordingLeaseOrCompletedRecovery(
			env,
			session.id,
			input.recordingId,
		);
		return recoverCompletedSource(completedSource);
	}
	await requireStudioRecordingLease(env, session.id, input.recordingId);

	try {
		const upload = bucket.resumeMultipartUpload(sourceKey, input.uploadId);
		await upload.abort();
	} catch (abortError) {
		const recoveredSource = await bucket.head(sourceKey).catch(() => null);
		if (recoveredSource) return recoverCompletedSource(recoveredSource);
		throw abortError;
	}
	const recoveredSource = await bucket.head(sourceKey);
	if (recoveredSource) return recoverCompletedSource(recoveredSource);

	const leaseReleased = await releaseStudioRecordingLease(env, {
		nextStatus: "idle",
		recordingId: input.recordingId,
		sessionId: session.id,
	});
	return {
		aborted: true,
		handoff: null,
		leaseReleased,
		outcome: "aborted",
		recordingId: input.recordingId,
		recovered: false,
		sessionId: session.id,
		sourceKey,
	};
}

export async function heartbeatStudioRecording(
	env: StudioEnv,
	user: StudioUser,
	input: StudioRecordingHeartbeatInput,
) {
	requireStudioDb(env);
	const session = await requireSessionManager(env, user, input.sessionId);
	requireProdRecordingSession(session);
	assertRecordingId(input.recordingId);
	await requireStudioRecordingLease(env, input.sessionId, input.recordingId);

	return {
		leaseStatus: "active" as const,
		recordingId: input.recordingId,
		sessionId: input.sessionId,
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
	requireProdRecordingSession(session);
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
	let handoff: Awaited<ReturnType<typeof saveRecordingReadyMarker>>;
	try {
		handoff = await saveRecordingReadyMarker(env, marker);
	} catch (error) {
		if (error instanceof StudioRecordingOutputClaimedError) {
			throw new StudioOperationError(
				"recording-output-claimed",
				error.message,
				409,
			);
		}
		throw error;
	}

	return { ...marker, ...handoff };
}
