import type { StudioEnv, StudioUser } from "../env";
import type { SendSubjectInput } from "notifications/src/contracts.js";
import {
	cloudflareStreamLiveInputIsConnected,
	createCloudflareStreamLiveInput,
	disableCloudflareStreamLiveInput,
	getCloudflareStreamConfig,
	getCloudflareStreamLiveInput,
	updateCloudflareStreamLiveInputPlaybackPolicy,
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
	createRealtimeKitMeeting,
	endRealtimeKitSession,
	getRealtimeKitConfig,
	type RealtimeKitRole,
} from "./realtimekit";
import {
	buildStudioSession,
	claimStudioStreamStart,
	claimStudioStreamNotification,
	createInviteToken,
	createReadyMarker,
	createRecordingId,
	createStudioSessionId,
	createStudioInviteRecord,
	getStudioSession,
	getStudioStreamPublisherLease,
	getStudioUserGithubHandle,
	getStudioUserId,
	hashInviteToken,
	isStudioSessionActive,
	redeemStudioInvite,
	reclaimStaleStudioStream,
	releaseStudioStreamNotificationClaim,
	resolveStudioInvite,
	saveRecordingReadyMarker,
	saveStudioSessionRecordingStatus,
	saveStudioSessionStatus,
	saveStudioSession,
	saveStudioStreamEnded,
	saveStudioStreamEndedForLease,
	saveStudioStreamFailed,
	saveStudioStreamLive,
	saveStudioStreamStart,
	studioStreamPublisherLeaseMatches,
	upsertStudioParticipant,
	userIsConfiguredStudioOperator,
	type StudioInvite,
	type StudioSessionRecord,
	type StudioRole,
	type StreamEnvironment,
} from "./studio";

export class StudioOperationError extends Error {
	readonly code:
		| "bad-request"
		| "content-unavailable"
		| "not-found"
			| "provider-cleanup-failed"
			| "provider-not-configured"
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
	prodConfirmation?: string;
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

const recordingUploadPartSizeBytes = 8 * 1024 * 1024;
const recordingIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const staleStreamStartingSeconds = 120;
const staleStreamLiveSeconds = 30;

async function requireConfiguredRealtimeKit(env: StudioEnv) {
	const config = await getRealtimeKitConfig(env);
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
	lease: {
		liveInputId: string;
		startToken: string;
	},
): Promise<boolean> {
	if (
		session.streamEnvironment !== "prod" ||
		session.streamNotificationQueuedAt !== null ||
		session.cloudflareStreamLiveInputId !== lease.liveInputId
	) {
		return false;
	}

	const notificationQueuedAt = nowSeconds();
	let claimed = false;
	try {
		requireContentBackedStreamSession(session);
		claimed = await claimStudioStreamNotification(env, {
			liveInputId: lease.liveInputId,
			notificationQueuedAt,
			sessionId: session.id,
			startToken: lease.startToken,
		});
		if (!claimed) return false;
		await requireNotificationsQueue(env).send(buildStreamNotification(session));
		return true;
	} catch (error) {
		if (claimed) {
			await releaseStudioStreamNotificationClaim(env, {
				liveInputId: lease.liveInputId,
				notificationQueuedAt,
				sessionId: session.id,
				startToken: lease.startToken,
			}).catch(() => undefined);
		}
		console.error("Studio stream notification failed", error);
		return false;
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
	if (!userIsConfiguredStudioOperator(env, user)) {
		throw new StudioOperationError(
			"unauthorized",
			"Studio operator access is required.",
			403,
		);
	}
	return session;
}

async function recoverStaleStudioStreamIfNeeded(
	env: StudioEnv,
	session: StudioSessionRecord,
): Promise<boolean> {
	const currentTime = nowSeconds();
	if (
		session.streamStatus === "starting" &&
		session.updatedAt <= currentTime - staleStreamStartingSeconds
	) {
		return await reclaimStaleStudioStream(env, {
			sessionId: session.id,
			staleBefore: currentTime - staleStreamStartingSeconds,
			streamStatus: "starting",
		});
	}

	if (
		session.streamStatus !== "live" ||
		session.updatedAt > currentTime - staleStreamLiveSeconds
	) {
		return false;
	}

	if (session.cloudflareStreamLiveInputId) {
		try {
			const config = await requireConfiguredCloudflareStream(env);
			const liveInput = await getCloudflareStreamLiveInput(
				config,
				session.cloudflareStreamLiveInputId,
			);
			if (cloudflareStreamLiveInputIsConnected(liveInput)) return false;
		} catch (error) {
			console.error("Could not reconcile stale Studio stream", error);
			return false;
		}
	}

	return await reclaimStaleStudioStream(env, {
		sessionId: session.id,
		staleBefore: currentTime - staleStreamLiveSeconds,
		streamStatus: "live",
	});
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
	if (
		input.streamEnvironment === "prod" &&
		input.prodConfirmation !== "PROD"
	) {
		throw new StudioOperationError(
			"bad-request",
			"Type PROD to arm a production stream.",
			400,
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
	const config = await getRealtimeKitConfig(env);
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
	let session = await requireSessionManager(env, user, input.sessionId);
	if (session.status === "complete") {
		throw new StudioOperationError(
			"session-ended",
			"Studio session has ended.",
			409,
		);
	}
	const recovered = await recoverStaleStudioStreamIfNeeded(env, session);
	if (recovered) {
		session = await requireSessionManager(env, user, input.sessionId);
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
	const streamToken = input.streamToken?.trim() || crypto.randomUUID();
	const claimed = await claimStudioStreamStart(env, session.id, streamToken);
	if (!claimed) {
		throw new StudioOperationError(
			"stream-active",
			"Studio stream is already active.",
			409,
		);
	}

	try {
		const config = await requireConfiguredCloudflareStream(env);
		const liveInput = session.cloudflareStreamLiveInputId
			? await updateCloudflareStreamLiveInputPlaybackPolicy(
					config,
					session.cloudflareStreamLiveInputId,
					session.streamEnvironment,
				)
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
			recovered,
			streamToken,
		};
	} catch (error) {
		await saveStudioStreamEnded(env, session.id, streamToken).catch(() => undefined);
		throw error;
	}
}

export async function confirmStudioStream(
	env: StudioEnv,
	user: StudioUser,
	input: StudioStreamInput,
) {
	requireStudioDb(env);
	const session = await requireSessionManager(env, user, input.sessionId);
	const liveInputId = session.cloudflareStreamLiveInputId;
	if (!liveInputId) {
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
	const streamToken = input.streamToken?.trim();
	if (!streamToken) {
		throw new StudioOperationError(
			"bad-request",
			"streamToken is required to confirm Studio stream publishing.",
			400,
		);
	}
	const publisherLease = {
		liveInputId,
		startToken: streamToken,
	};
	if (session.streamStatus === "live") {
		const ownsLiveLease = await studioStreamPublisherLeaseMatches(env, {
			...publisherLease,
			sessionId: session.id,
		});
		if (!ownsLiveLease) {
			throw new StudioOperationError(
				"stream-active",
				"The live Studio stream belongs to a different publisher.",
				409,
			);
		}
		return {
			sessionId: session.id,
			streamStatus: "live" as const,
			notified: await notifyStudioStreamIfNeeded(env, session, publisherLease),
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
		liveInputId,
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
		liveInputId,
		playbackUrl,
		publicLive: session.streamEnvironment === "prod",
		sessionId: session.id,
		startToken: streamToken,
	});
	if (!savedLive) {
		const latest = await getStudioSession(env, session.id);
		const ownsLiveLease = latest?.streamStatus === "live" &&
			latest.cloudflareStreamLiveInputId === liveInputId &&
			await studioStreamPublisherLeaseMatches(env, {
				...publisherLease,
				sessionId: session.id,
			});
		if (ownsLiveLease) {
			return {
				sessionId: session.id,
				streamStatus: "live" as const,
				notified: await notifyStudioStreamIfNeeded(
					env,
					latest,
					publisherLease,
				),
			};
		}
		throw new StudioOperationError(
			latest?.streamStatus === "live" ? "stream-active" : "bad-request",
			latest?.streamStatus === "live"
				? "The live Studio stream belongs to a different publisher."
				: "Studio stream is no longer waiting for live confirmation.",
			409,
		);
	}

	const notified = await notifyStudioStreamIfNeeded(env, session, publisherLease);

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
	const isActive = session.streamStatus === "starting" || session.streamStatus === "live";
	if (!isActive) {
		const changed = input.streamToken
			? await saveStudioStreamEnded(env, session.id, input.streamToken)
			: false;
		return {
			changed,
			sessionId: session.id,
			streamStatus: "ended" as const,
		};
	}
	if (!input.streamToken) {
		throw new StudioOperationError(
			"stream-active",
			"streamToken is required to stop the active Studio stream. Reset it explicitly if the publisher token was lost.",
			409,
		);
	}

	const changed = await saveStudioStreamEnded(env, session.id, input.streamToken);
	if (!changed) {
		const latest = await getStudioSession(env, session.id);
		if (latest?.streamStatus === "starting" || latest?.streamStatus === "live") {
			throw new StudioOperationError(
				"stream-active",
				"The active Studio stream belongs to a different publisher.",
				409,
			);
		}
	}

	return {
		changed,
		sessionId: session.id,
		streamStatus: "ended" as const,
	};
}

export async function resetStudioStream(
	env: StudioEnv,
	user: StudioUser,
	input: StudioStreamInput,
) {
	requireStudioDb(env);
	const session = await requireSessionManager(env, user, input.sessionId);
	if (session.streamStatus !== "starting" && session.streamStatus !== "live") {
		return {
			reset: false,
			sessionId: session.id,
			streamStatus: session.streamStatus,
		};
	}

	const reset = await saveStudioStreamFailed(env, session.id, input.streamToken);
	if (!reset) {
		const latest = await getStudioSession(env, session.id);
		if (latest?.streamStatus === "starting" || latest?.streamStatus === "live") {
			throw new StudioOperationError(
				"stream-active",
				"The active Studio stream belongs to a different publisher.",
				409,
			);
		}
		return {
			reset: false,
			sessionId: session.id,
			streamStatus: latest?.streamStatus ?? "failed" as const,
		};
	}

	return {
		reset: true,
		sessionId: session.id,
		streamStatus: "failed" as const,
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

export async function endStudioSession(
	env: StudioEnv,
	user: StudioUser,
	input: EndStudioSessionInput,
) {
	const session = await requireSessionManager(env, user, input.sessionId);
	const publisherLease = await getStudioStreamPublisherLease(env, session.id);
	await saveStudioSessionStatus(env, session.id, "complete");

	let liveInputId = session.cloudflareStreamLiveInputId;
	if (publisherLease) {
		const endedMatchingLease = await saveStudioStreamEndedForLease(env, {
			liveInputId: publisherLease.liveInputId,
			sessionId: session.id,
			startToken: publisherLease.startToken,
		});
		if (!endedMatchingLease) {
			throw new StudioOperationError(
				"provider-cleanup-failed",
				"Studio ended publicly, but its publisher lease changed during cleanup. Retry ending the session.",
				502,
			);
		}
		liveInputId = publisherLease.liveInputId;
	} else {
		await saveStudioStreamEnded(env, session.id);
	}

	if (liveInputId) {
		try {
			const config = await requireConfiguredCloudflareStream(env);
			await disableCloudflareStreamLiveInput(config, liveInputId);
		} catch (error) {
			const message = error instanceof Error
				? error.message
				: "Cloudflare Stream cleanup failed";
			throw new StudioOperationError(
				"provider-cleanup-failed",
				`Studio ended publicly, but Cloudflare Stream cleanup failed. Retry ending the session: ${message}`,
				502,
			);
		}
	}

	if (session.realtimeKitMeetingId) {
		try {
			const config = await requireConfiguredRealtimeKit(env);
			await endRealtimeKitSession(config, session.realtimeKitMeetingId);
		} catch (error) {
			const message = error instanceof Error
				? error.message
				: "RealtimeKit cleanup failed";
			throw new StudioOperationError(
				"provider-cleanup-failed",
				`Studio ended locally, but RealtimeKit cleanup failed. Retry ending the session: ${message}`,
				502,
			);
		}
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
	const canManage = userIsConfiguredStudioOperator(env, user);
	if (input.role === "guest") {
		if (!canManage) {
			if (!input.inviteToken) {
				throw new StudioOperationError(
					"unauthorized",
					"Guest invite token is required to join this Studio session.",
					403,
				);
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
