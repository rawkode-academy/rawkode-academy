import type { StudioEnv, StudioUser } from "../env";
import {
	getStudioContentEvents,
	getStudioUpcomingContentEvents,
	type StudioContentVideo,
} from "./content";
import type { RealtimeKitMeeting } from "./realtimekit";

export type StudioRole = "guest" | "host" | "producer" | "program";
export type RecordingStatus =
	| "failed"
	| "idle"
	| "recording"
	| "uploaded"
	| "transcoding"
	| "in-review"
	| "awaiting-publication"
	| "withdrawn"
	| "vod-ready";
export type StudioRecordingVisibility = "public" | "review";
export type StudioReviewState =
	| "pending"
	| "awaiting-transcode"
	| "attached"
	| "published"
	| "promoted"
	| "failed"
	| "withdrawn";
export type StreamEnvironment = "prod" | "test";
export type StudioStreamStatus = "ended" | "failed" | "idle" | "live" | "starting";
export type StudioSessionStatus = "scheduled" | "live" | "recording" | "complete";

export interface StudioPersonSummary {
	avatarUrl?: string | null;
	githubHandle?: string | null;
	id: string;
	name: string;
}

export interface StudioSessionSummary {
	id: string;
	title: string;
	show: string;
	startsAt: string;
	status: StudioSessionStatus;
	contentVideoId: string | null;
	contentVideoSlug: string | null;
	hosts: StudioPersonSummary[];
	guests: StudioPersonSummary[];
	recordingStatus: RecordingStatus;
	realtimeKitMeetingId: string | null;
	recordingPrefix: string;
	streamEnvironment: StreamEnvironment;
	streamStatus: StudioStreamStatus;
	cloudflareStreamLiveInputId: string | null;
	cloudflareStreamPlaybackUrl: string | null;
	streamStartedAt: number | null;
	streamEndedAt: number | null;
	streamNotificationQueuedAt: number | null;
	// Recordings go to Payload client review before any public VOD exists.
	reviewRequired: boolean;
}

export interface StudioSessionRecord extends StudioSessionSummary {
	showId: string;
	createdById: string;
	createdByGithub: string | null;
	createdAt: number;
	updatedAt: number;
}

export interface StudioEventSummary {
	id: string;
	title: string;
	show: string;
	showId: string;
	startsAt: string | null;
	contentVideoSlug: string | null;
	hosts: StudioPersonSummary[];
	guests: StudioPersonSummary[];
	sessions: StudioSessionSummary[];
}

export interface StudioRecordingReadyMarker {
	contractVersion: 1;
	videoId: string;
	studioSessionId: string;
	recordingId: string;
	sourceBucket: string;
	sourceKey: string;
	sourceEtag: string;
	sourceFormat: "mkv" | "mp4" | "webm";
	outputPrefix: string;
}

// Contract v2 (studio-recording-ingest): a private review proxy under the
// recording's own review/ prefix. Never public until promoted.
export interface StudioRecordingReviewMarker
	extends Omit<StudioRecordingReadyMarker, "contractVersion"> {
	contractVersion: 2;
	visibility: "review";
	outputMode: "review-proxy";
	transcodeAttempt: number;
}

// Contract v2 promotion of an approved review recording: public HLS under
// videos/{videoId}/ without the raw source or original.mkv.
export interface StudioRecordingApprovedMarker
	extends Omit<StudioRecordingReadyMarker, "contractVersion"> {
	contractVersion: 2;
	visibility: "public";
	outputMode: "hls-approved";
	transcodeAttempt: number;
}

export type StudioRecordingMarker =
	| StudioRecordingReadyMarker
	| StudioRecordingReviewMarker
	| StudioRecordingApprovedMarker;

export interface StudioTranscodeStatus {
	completedAt: string | null;
	status: string;
	statusKey: string;
	streamUrl: string | null;
}

export interface StudioRecordingSummary {
	recordingId: string;
	videoId: string;
	sourceBucket: string;
	sourceKey: string;
	sourceEtag: string;
	sourceFormat: "mkv" | "mp4" | "webm";
	outputPrefix: string;
	readyMarkerKey: string;
	handoffStatus: string;
	status: RecordingStatus;
	createdAt: number;
	updatedAt: number;
	transcode: StudioTranscodeStatus | null;
	visibility: StudioRecordingVisibility;
	reviewPrefix: string | null;
	reviewState: StudioReviewState | null;
	reviewRevisionId: string | null;
	reviewPayloadVideoId: number | null;
	reviewLastError: string | null;
	reviewUrl: string | null;
}

export interface StudioDashboard {
	events: StudioEventSummary[];
	isOperator: boolean;
	contentError: string | null;
	user: StudioUser | null;
	sessions: StudioSessionSummary[];
}

export interface StudioInvite {
	tokenHash: string;
	sessionId: string;
	role: StudioRole;
	expiresAt: number;
	maxUses: number;
	usedCount: number;
	createdById: string;
	createdByGithub: string | null;
	createdAt: number;
	revokedAt: number | null;
}

export interface ResolvedStudioInvite {
	invite: StudioInvite;
	session: StudioSessionRecord;
}

type StudioSessionRow = {
	id: string;
	content_video_id: string | null;
	content_video_slug: string | null;
	title: string;
	show_id: string;
	show_title: string;
	content_hosts_json: string | null;
	content_guests_json: string | null;
	starts_at: string;
	status: StudioSessionStatus;
	recording_status: RecordingStatus;
	realtimekit_meeting_id: string | null;
	recording_prefix: string;
	stream_environment: StreamEnvironment;
	stream_status: StudioStreamStatus;
	cloudflare_stream_live_input_id: string | null;
	cloudflare_stream_playback_url: string | null;
	stream_started_at: number | null;
	stream_ended_at: number | null;
	stream_notification_queued_at: number | null;
	stream_start_token: string | null;
	review_required?: number | null;
	created_by_id: string;
	created_by_github: string | null;
	created_at: number;
	updated_at: number;
};

export interface StudioPublicLiveState {
	live: boolean;
	playbackUrl: string | null;
	session: {
		id: string;
		show: string;
		startedAt: number | null;
		startsAt: string;
		title: string;
	} | null;
}

export interface StudioPublicShowLineup {
	live: {
		id: string;
		title: string;
		show: string;
		startsAt: string;
		startedAt: number | null;
		playbackUrl: string;
	} | null;
	upcoming: Array<{
		id: string;
		title: string;
		show: string;
		startsAt: string;
	}>;
}

type StudioPublicShowRow = {
	id: string;
	title: string;
	show_title: string;
	starts_at: string;
	stream_started_at?: number | null;
	cloudflare_stream_playback_url?: string | null;
};

type StudioInviteRow = {
	token_hash: string;
	session_id: string;
	role: StudioRole;
	expires_at: number;
	max_uses: number;
	used_count: number;
	created_by_id: string;
	created_by_github: string | null;
	created_at: number;
	revoked_at: number | null;
};

type StudioRecordingRow = {
	recording_id: string;
	session_id: string;
	video_id: string;
	source_bucket: string;
	source_key: string;
	source_etag: string;
	source_format: "mkv" | "mp4" | "webm";
	output_prefix: string;
	ready_marker_key: string;
	status: string;
	created_at: number;
	updated_at: number;
	visibility?: StudioRecordingVisibility | null;
	review_state?: StudioReviewState | null;
	review_prefix?: string | null;
	review_revision_id?: string | null;
	review_payload_video_id?: number | null;
	review_last_error?: string | null;
};

// Full review columns, as read by the Payload handoff.
export type StudioReviewRecordingRow = StudioRecordingRow & {
	visibility: StudioRecordingVisibility;
	source_bytes: number | null;
	review_prefix: string | null;
	review_idempotency_key: string | null;
	review_state: StudioReviewState | null;
	review_requested_by: string | null;
	review_adoption_id: string | null;
	review_payload_video_id: number | null;
	review_revision_id: string | null;
	review_publication_id: string | null;
	review_attempts: number;
	review_transcode_attempt: number;
	review_marker_etag: string | null;
	review_next_attempt_at: number | null;
	review_last_error: string | null;
	review_attached_at: number | null;
	review_promoted_at: number | null;
	review_published_at: number | null;
	review_promotion_attempt: number;
};

function nowSeconds(): number {
	return Math.floor(Date.now() / 1000);
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export function createStudioSessionId(show: string): string {
	const slug = slugify(show) || "studio";
	return `${slug}-${crypto.randomUUID().slice(0, 8)}`;
}

export function createRecordingId(): string {
	return `recording-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

export function createReadyMarkerKey(
	sessionId: string,
	recordingId: string,
): string {
	return `studio/recordings/${sessionId}/${recordingId}/ready.json`;
}

export function createReviewOutputPrefix(
	sessionId: string,
	recordingId: string,
): string {
	return `studio/recordings/${sessionId}/${recordingId}/review/`;
}

export function createReviewIdempotencyKey(
	sessionId: string,
	recordingId: string,
	sourceEtag: string,
): string {
	return `studio:${sessionId}:${recordingId}:${normalizeEtag(sourceEtag)}`;
}

export function getReviewUrl(payloadVideoId: number | null): string | null {
	return payloadVideoId
		? `https://preview.rawkode.academy/review?videoId=${payloadVideoId}`
		: null;
}

type MarkerInput = Omit<
	StudioRecordingReadyMarker,
	"contractVersion" | "outputPrefix"
>;

function markerFields(input: MarkerInput) {
	return {
		videoId: input.videoId,
		studioSessionId: input.studioSessionId,
		recordingId: input.recordingId,
		sourceBucket: input.sourceBucket,
		sourceKey: input.sourceKey,
		sourceEtag: input.sourceEtag,
		sourceFormat: input.sourceFormat,
	};
}

export function createReviewReadyMarker(
	input: MarkerInput,
	transcodeAttempt: number,
): StudioRecordingReviewMarker {
	return {
		contractVersion: 2,
		visibility: "review",
		outputMode: "review-proxy",
		transcodeAttempt,
		...markerFields(input),
		outputPrefix: createReviewOutputPrefix(input.studioSessionId, input.recordingId),
	};
}

export function createApprovedReadyMarker(
	input: MarkerInput,
	transcodeAttempt: number,
): StudioRecordingApprovedMarker {
	return {
		contractVersion: 2,
		visibility: "public",
		outputMode: "hls-approved",
		transcodeAttempt,
		...markerFields(input),
		outputPrefix: `videos/${input.videoId}/`,
	};
}

export function createReadyMarker(
	input: Omit<StudioRecordingReadyMarker, "contractVersion" | "outputPrefix"> & {
		outputPrefix?: string;
	},
): StudioRecordingReadyMarker {
	return {
		contractVersion: 1,
		videoId: input.videoId,
		studioSessionId: input.studioSessionId,
		recordingId: input.recordingId,
		sourceBucket: input.sourceBucket,
		sourceKey: input.sourceKey,
		sourceEtag: input.sourceEtag,
		sourceFormat: input.sourceFormat,
		outputPrefix: input.outputPrefix ?? `videos/${input.videoId}/`,
	};
}

function fallbackSession(): StudioSessionRecord {
	const createdAt = nowSeconds();
	return {
		id: "rawkode-live-next",
		contentVideoId: null,
		contentVideoSlug: null,
		title: "Rawkode Live production room",
		show: "Rawkode Live",
		showId: "rawkode-live",
		startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
		status: "scheduled",
		hosts: [
			{
				id: "rawkode",
				name: "Rawkode",
				githubHandle: "rawkode",
			},
		],
		guests: [],
		recordingStatus: "idle",
		realtimeKitMeetingId: null,
		recordingPrefix: "studio/recordings/rawkode-live-next/",
		streamEnvironment: "test",
		streamStatus: "idle",
		cloudflareStreamLiveInputId: null,
		cloudflareStreamPlaybackUrl: null,
		streamStartedAt: null,
		streamEndedAt: null,
		streamNotificationQueuedAt: null,
		reviewRequired: false,
		createdById: "seed",
		createdByGithub: "rawkode",
		createdAt,
		updatedAt: createdAt,
	};
}

function rowToSession(row: StudioSessionRow): StudioSessionRecord {
	const contentHosts = parsePeopleJson(row.content_hosts_json);
	const createdHost = row.created_by_github
		? [{
				githubHandle: row.created_by_github,
				id: row.created_by_github,
				name: row.created_by_github,
			}]
		: [];
	return {
		id: row.id,
		contentVideoId: row.content_video_id,
		contentVideoSlug: row.content_video_slug,
		title: row.title,
		show: row.show_title,
		showId: row.show_id,
		startsAt: row.starts_at,
		status: row.status,
		hosts: mergePeople(contentHosts, createdHost),
		guests: parsePeopleJson(row.content_guests_json),
		recordingStatus: row.recording_status,
		realtimeKitMeetingId: row.realtimekit_meeting_id,
		recordingPrefix: row.recording_prefix,
		streamEnvironment: row.stream_environment ?? "test",
		streamStatus: row.stream_status ?? "idle",
		cloudflareStreamLiveInputId: row.cloudflare_stream_live_input_id ?? null,
		cloudflareStreamPlaybackUrl: row.cloudflare_stream_playback_url ?? null,
		streamStartedAt: row.stream_started_at ?? null,
		streamEndedAt: row.stream_ended_at ?? null,
		streamNotificationQueuedAt: row.stream_notification_queued_at ?? null,
		reviewRequired: row.review_required === 1,
		createdById: row.created_by_id,
		createdByGithub: row.created_by_github,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function isUpcomingEvent(event: StudioContentVideo, now = Date.now()): boolean {
	return event.publishedAt ? Date.parse(event.publishedAt) >= now : false;
}

function contentVideoToEvent(
	video: StudioContentVideo,
	sessions: StudioSessionSummary[],
): StudioEventSummary {
	return {
		id: video.id,
		title: video.title,
		show: video.show?.name ?? "Rawkode",
		showId: video.show?.id ?? "rawkode",
		startsAt: video.publishedAt,
		contentVideoSlug: video.slug,
		hosts: video.show?.hosts ?? [],
		guests: video.guests,
		sessions,
	};
}

function getDb(env: StudioEnv | undefined): D1Database | null {
	return env?.STUDIO_DB ?? null;
}

function isMissingStudioInviteTableError(error: unknown): boolean {
	return error instanceof Error &&
		error.message.includes("no such table: studio_invites");
}

function isMissingStudioSessionsTableError(error: unknown): boolean {
	return error instanceof Error &&
		error.message.includes("no such table: studio_sessions");
}

function isMissingStudioRecordingsTableError(error: unknown): boolean {
	return error instanceof Error &&
		error.message.includes("no such table: studio_recordings");
}

export function normalizeEtag(value: string): string {
	return value.replace(/^"|"$/g, "");
}

export function getStudioUserGithubHandle(user: StudioUser): string | null {
	const handle = user.username?.trim().replace(/^@/, "").toLowerCase();
	return handle || null;
}

export function getStudioUserId(user: StudioUser): string {
	return getStudioUserGithubHandle(user) ?? user.id;
}

function personMatchesUser(person: StudioPersonSummary, user: StudioUser): boolean {
	const userGithub = getStudioUserGithubHandle(user);
	const userId = getStudioUserId(user);
	return (
		person.id === userId ||
		(Boolean(userGithub) && person.githubHandle === userGithub)
	);
}

export function userIsListedOnStudioSession(
	session: StudioSessionRecord,
	user: StudioUser,
): boolean {
	return [...session.hosts, ...session.guests].some((person) =>
		personMatchesUser(person, user)
	);
}

export function isStudioSessionActive(session: StudioSessionSummary): boolean {
	return Boolean(session.realtimeKitMeetingId) && session.status !== "complete";
}

export function getStudioSessionWatchUrl(
	session: Pick<StudioSessionRecord, "contentVideoSlug">,
): string | null {
	return session.contentVideoSlug
		? `https://rawkode.academy/watch/${session.contentVideoSlug}`
		: null;
}

function parsePeopleJson(value: string | null): StudioPersonSummary[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value) as StudioPersonSummary[];
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((person) => person?.id && person.name)
			.map((person) => ({
				avatarUrl: person.avatarUrl ?? null,
				githubHandle: person.githubHandle ?? null,
				id: person.id,
				name: person.name,
			}));
	} catch {
		return [];
	}
}

function stringifyPeopleJson(people: StudioPersonSummary[]): string {
	return JSON.stringify(people.map((person) => ({
		avatarUrl: person.avatarUrl ?? null,
		githubHandle: person.githubHandle ?? null,
		id: person.id,
		name: person.name,
	})));
}

function normalizeOutputPrefix(outputPrefix: string): string {
	return outputPrefix.endsWith("/") ? outputPrefix : `${outputPrefix}/`;
}

function mergePeople(
	primary: StudioPersonSummary[],
	secondary: StudioPersonSummary[],
): StudioPersonSummary[] {
	const merged = new Map<string, StudioPersonSummary>();
	for (const person of [...primary, ...secondary]) {
		const key = person.githubHandle ?? person.id;
		if (!merged.has(key)) {
			merged.set(key, person);
		}
	}
	return [...merged.values()];
}

function encodeBase64UrlFromBytes(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

export function createInviteToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return encodeBase64UrlFromBytes(bytes);
}

export async function hashInviteToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(token),
	);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function rowToInvite(row: StudioInviteRow): StudioInvite {
	return {
		tokenHash: row.token_hash,
		sessionId: row.session_id,
		role: row.role,
		expiresAt: row.expires_at,
		maxUses: row.max_uses,
		usedCount: row.used_count,
		createdById: row.created_by_id,
		createdByGithub: row.created_by_github,
		createdAt: row.created_at,
		revokedAt: row.revoked_at,
	};
}

function rowToRecording(row: StudioRecordingRow): StudioRecordingSummary {
	const visibility = row.visibility ?? "public";
	const reviewState = visibility === "review" ? row.review_state ?? null : null;
	const reviewPayloadVideoId = row.review_payload_video_id ?? null;
	return {
		recordingId: row.recording_id,
		videoId: row.video_id,
		sourceBucket: row.source_bucket,
		sourceKey: row.source_key,
		sourceEtag: row.source_etag,
		sourceFormat: row.source_format,
		outputPrefix: row.output_prefix,
		readyMarkerKey: row.ready_marker_key,
		handoffStatus: row.status,
		status: deriveRecordingStatus(row.status, null, reviewState),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		transcode: null,
		visibility,
		reviewPrefix: row.review_prefix ?? null,
		reviewState,
		reviewRevisionId: row.review_revision_id ?? null,
		reviewPayloadVideoId,
		reviewLastError: row.review_last_error ?? null,
		reviewUrl: visibility === "review" ? getReviewUrl(reviewPayloadVideoId) : null,
	};
}

async function getTranscodeStatus(
	env: StudioEnv | undefined,
	recording: StudioRecordingSummary,
): Promise<StudioTranscodeStatus | null> {
	if (!env?.RECORDINGS) {
		return null;
	}

	// An unpromoted review recording reports its private proxy status and never a
	// public stream URL. After promotion, output_prefix is videos/{id}/ as usual.
	const privateReview = recording.visibility === "review" &&
		recording.reviewState !== "promoted";
	const outputPrefix = normalizeOutputPrefix(
		privateReview && recording.reviewPrefix
			? recording.reviewPrefix
			: recording.outputPrefix,
	);
	const statusKey = `${outputPrefix}transcode-status.json`;
	const object = await env.RECORDINGS.get(statusKey).catch(() => null);
	if (!object) {
		return null;
	}

	const status = (await object.json().catch(() => null)) as {
		completedAt?: string;
		status?: string;
	} | null;
	if (!status?.status) {
		return null;
	}

	return {
		completedAt: status.completedAt ?? null,
		status: status.status,
		statusKey,
		streamUrl:
			status.status === "complete" && !privateReview
				? `https://content.rawkode.academy/${outputPrefix}stream.m3u8`
				: null,
	};
}

function deriveRecordingStatus(
	handoffStatus: string,
	transcode: StudioTranscodeStatus | null,
	reviewState: StudioReviewState | null = null,
): RecordingStatus {
	if (reviewState && reviewState !== "promoted") {
		if (reviewState === "published") return "awaiting-publication";
		if (reviewState === "withdrawn") return "withdrawn";
		if (reviewState === "attached") return "in-review";
		if (reviewState === "failed" || transcode?.status === "failed") return "failed";
		if (transcode?.status) return "transcoding";
		return handoffStatus === "failed" ? "failed" : "uploaded";
	}
	if (transcode?.status === "complete") {
		return "vod-ready";
	}
	if (transcode?.status === "failed" || transcode?.status === "error") {
		return "failed";
	}
	if (transcode?.status) {
		return "transcoding";
	}
	if (handoffStatus === "failed") {
		return "failed";
	}
	return "uploaded";
}

async function getDerivedSessionRecordingStatus(
	env: StudioEnv | undefined,
	session: StudioSessionRecord,
): Promise<RecordingStatus> {
	if (session.recordingStatus === "recording") {
		return session.recordingStatus;
	}

	const [latestRecording] = await listStudioRecordings(env, session.id);
	return latestRecording?.status ?? session.recordingStatus;
}

async function withDerivedSessionRecordingStatuses(
	env: StudioEnv | undefined,
	sessions: StudioSessionRecord[],
): Promise<StudioSessionRecord[]> {
	return await Promise.all(sessions.map(async (session) => ({
		...session,
		recordingStatus: await getDerivedSessionRecordingStatus(env, session),
	})));
}

export function userOwnsStudioSession(
	session: StudioSessionRecord,
	user: StudioUser,
): boolean {
	const userId = getStudioUserId(user);
	const githubHandle = getStudioUserGithubHandle(user);
	return (
		session.createdById === userId ||
		(Boolean(githubHandle) && session.createdByGithub === githubHandle)
	);
}

export function userIsConfiguredStudioOperator(
	env: StudioEnv,
	user: StudioUser,
): boolean {
	const allowed = (env.STUDIO_OPERATOR_GITHUB_HANDLES ?? "rawkode")
		.split(",")
		.map((handle) => handle.trim().toLowerCase())
		.filter(Boolean);
	const handle = getStudioUserGithubHandle(user) ?? user.id.toLowerCase();
	return allowed.includes(handle);
}

export async function listStudioSessions(
	env: StudioEnv | undefined,
): Promise<StudioSessionRecord[]> {
	const db = getDb(env);
	if (!db) return [fallbackSession()];

	let results: StudioSessionRow[] | undefined;
	try {
		({ results } = await db
			.prepare(
				`SELECT id,
				        content_video_id,
				        content_video_slug,
				        title,
				        show_id,
				        show_title,
				        content_hosts_json,
				        content_guests_json,
				        starts_at,
				        status,
				        recording_status,
				        realtimekit_meeting_id,
				        recording_prefix,
				        stream_environment,
				        stream_status,
				        cloudflare_stream_live_input_id,
				        cloudflare_stream_playback_url,
				        stream_started_at,
				        stream_ended_at,
				        stream_notification_queued_at,
				        review_required,
				        created_by_id,
				        created_by_github,
				        created_at,
				        updated_at
				   FROM studio_sessions
				  ORDER BY starts_at DESC, created_at DESC
				  LIMIT 50`,
			)
			.all<StudioSessionRow>());
	} catch (error) {
		if (isMissingStudioSessionsTableError(error)) return [];
		throw error;
	}

	return await withDerivedSessionRecordingStatuses(
		env,
		(results ?? []).map(rowToSession),
	);
}

function groupSessionsByContentVideoId(
	sessions: StudioSessionSummary[],
): Map<string, StudioSessionSummary[]> {
	const grouped = new Map<string, StudioSessionSummary[]>();
	for (const session of sessions) {
		if (!session.contentVideoId) continue;
		const existing = grouped.get(session.contentVideoId) ?? [];
		existing.push(session);
		grouped.set(session.contentVideoId, existing);
	}
	return grouped;
}

function sortSessionsForEvent(
	sessions: StudioSessionSummary[],
): StudioSessionSummary[] {
	return [...sessions].sort((left, right) =>
		right.startsAt.localeCompare(left.startsAt) ||
		right.id.localeCompare(left.id)
	);
}

function contentEventIncludesUser(event: StudioContentVideo, user: StudioUser): boolean {
	return [
		...(event.show?.hosts ?? []),
		...event.guests,
	].some((person) => personMatchesUser(person, user));
}

async function loadContentEvents(
	env: StudioEnv | undefined,
	options: { upcomingOnly?: boolean } = {},
): Promise<{
	error: string | null;
	events: StudioContentVideo[];
}> {
	if (!env) return { error: null, events: [] };
	try {
		const events = options.upcomingOnly
			? await getStudioUpcomingContentEvents(env)
			: await getStudioContentEvents(env);
		return { error: null, events };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : "Rawkode content graph failed",
			events: [],
		};
	}
}

export async function listStudioSessionsForUser(
	env: StudioEnv | undefined,
	user: StudioUser,
): Promise<StudioSessionRecord[]> {
	const db = getDb(env);
	if (!db) {
		const session = fallbackSession();
		return userOwnsStudioSession(session, user) ? [session] : [];
	}

	let results: StudioSessionRow[] | undefined;
	try {
		({ results } = await db
			.prepare(
				`SELECT id,
				        content_video_id,
				        content_video_slug,
				        title,
				        show_id,
				        show_title,
				        content_hosts_json,
				        content_guests_json,
				        starts_at,
				        status,
				        recording_status,
				        realtimekit_meeting_id,
				        recording_prefix,
				        stream_environment,
				        stream_status,
				        cloudflare_stream_live_input_id,
				        cloudflare_stream_playback_url,
				        stream_started_at,
				        stream_ended_at,
				        stream_notification_queued_at,
				        review_required,
				        created_by_id,
				        created_by_github,
				        created_at,
				        updated_at
				   FROM studio_sessions
				  WHERE created_by_id = ?
				     OR created_by_github = ?
				     OR EXISTS (
				          SELECT 1
				            FROM studio_participants
				           WHERE studio_participants.session_id = studio_sessions.id
				             AND (studio_participants.user_id = ?
				              OR studio_participants.github_handle = ?)
				             AND studio_participants.role IN ('host', 'producer', 'program')
				        )
				  ORDER BY starts_at ASC, created_at ASC
				  LIMIT 50`,
			)
			.bind(
				getStudioUserId(user),
				getStudioUserGithubHandle(user),
				getStudioUserId(user),
				getStudioUserGithubHandle(user),
			)
			.all<StudioSessionRow>());
	} catch (error) {
		if (isMissingStudioSessionsTableError(error)) return [];
		throw error;
	}

	return await withDerivedSessionRecordingStatuses(
		env,
		(results ?? []).map(rowToSession),
	);
}

export async function getStudioSession(
	env: StudioEnv | undefined,
	sessionId: string,
): Promise<StudioSessionRecord | null> {
	const db = getDb(env);
	if (!db) {
		const session = fallbackSession();
		return session.id === sessionId ? session : null;
	}

	let row: StudioSessionRow | null;
	try {
		row = await db
			.prepare(
				`SELECT id,
				        content_video_id,
				        content_video_slug,
				        title,
				        show_id,
				        show_title,
				        content_hosts_json,
				        content_guests_json,
				        starts_at,
				        status,
				        recording_status,
				        realtimekit_meeting_id,
				        recording_prefix,
				        stream_environment,
				        stream_status,
				        cloudflare_stream_live_input_id,
				        cloudflare_stream_playback_url,
				        stream_started_at,
				        stream_ended_at,
				        stream_notification_queued_at,
				        review_required,
				        created_by_id,
				        created_by_github,
				        created_at,
				        updated_at
				   FROM studio_sessions
				  WHERE id = ?`,
			)
			.bind(sessionId)
			.first<StudioSessionRow>();
	} catch (error) {
		if (isMissingStudioSessionsTableError(error)) return null;
		throw error;
	}

	if (!row) return null;
	const [session] = await withDerivedSessionRecordingStatuses(env, [rowToSession(row)]);
	return session ?? null;
}

export async function getPublicStudioLiveState(
	env: StudioEnv | undefined,
	videoSlug: string,
): Promise<StudioPublicLiveState> {
	const db = getDb(env);
	if (!db || !videoSlug.trim()) {
		return {
			live: false,
			playbackUrl: null,
			session: null,
		};
	}

	let row: StudioSessionRow | null;
	try {
		row = await db
			.prepare(
				`SELECT id,
				        content_video_id,
				        content_video_slug,
				        title,
				        show_id,
				        show_title,
				        content_hosts_json,
				        content_guests_json,
				        starts_at,
				        status,
				        recording_status,
				        realtimekit_meeting_id,
				        recording_prefix,
				        stream_environment,
				        stream_status,
				        cloudflare_stream_live_input_id,
				        cloudflare_stream_playback_url,
				        stream_started_at,
				        stream_ended_at,
				        stream_notification_queued_at,
				        review_required,
				        created_by_id,
				        created_by_github,
				        created_at,
				        updated_at
				   FROM studio_sessions
				  WHERE content_video_slug = ?
				    AND stream_environment = 'prod'
				    AND stream_status = 'live'
				    AND status = 'live'
				    AND cloudflare_stream_playback_url IS NOT NULL
				  ORDER BY COALESCE(stream_started_at, updated_at) DESC
				  LIMIT 1`,
			)
			.bind(videoSlug.trim())
			.first<StudioSessionRow>();
	} catch (error) {
		if (isMissingStudioSessionsTableError(error)) {
				return {
					live: false,
					playbackUrl: null,
					session: null,
				};
		}
		throw error;
	}

	if (!row?.cloudflare_stream_playback_url) {
		return {
			live: false,
			playbackUrl: null,
			session: null,
		};
	}

	return {
		live: true,
		playbackUrl: row.cloudflare_stream_playback_url,
		session: {
			id: row.id,
			show: row.show_title,
			startedAt: row.stream_started_at ?? null,
			startsAt: row.starts_at,
			title: row.title,
		},
	};
}

export async function getPublicStudioShowLineup(
	env: StudioEnv | undefined,
): Promise<StudioPublicShowLineup> {
	const db = getDb(env);
	if (!db) return { live: null, upcoming: [] };

	try {
		const [live, upcoming] = await Promise.all([
			db.prepare(
				`SELECT id, title, show_title, starts_at, stream_started_at,
				        cloudflare_stream_playback_url
				   FROM studio_sessions
				  WHERE stream_environment = 'prod'
				    AND stream_status = 'live'
				    AND status = 'live'
				    AND cloudflare_stream_playback_url IS NOT NULL
				  ORDER BY stream_started_at DESC, updated_at DESC
				  LIMIT 1`,
			).first<StudioPublicShowRow>(),
			db.prepare(
				`SELECT id, title, show_title, starts_at
				   FROM studio_sessions
				  WHERE stream_environment = 'prod'
				    AND status = 'scheduled'
				    AND stream_started_at IS NULL
				    AND stream_status IN ('idle', 'ended', 'failed')
				    AND starts_at >= ?
				  ORDER BY starts_at ASC, created_at ASC
				  LIMIT 50`,
			).bind(new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()).all<StudioPublicShowRow>(),
		]);

		return {
			live: live?.cloudflare_stream_playback_url
				? {
					id: live.id,
					title: live.title,
					show: live.show_title,
					startsAt: live.starts_at,
					startedAt: live.stream_started_at ?? null,
					playbackUrl: live.cloudflare_stream_playback_url,
				}
				: null,
			upcoming: (upcoming.results ?? []).map((row) => ({
				id: row.id,
				title: row.title,
				show: row.show_title,
				startsAt: row.starts_at,
			})),
		};
	} catch (error) {
		if (isMissingStudioSessionsTableError(error)) {
			return { live: null, upcoming: [] };
		}
		throw error;
	}
}

export async function listStudioRecordings(
	env: StudioEnv | undefined,
	sessionId: string,
): Promise<StudioRecordingSummary[]> {
	const db = getDb(env);
	if (!db) return [];

	let results: StudioRecordingRow[] | undefined;
	try {
		({ results } = await db
			.prepare(
				`SELECT recording_id,
				        session_id,
				        video_id,
				        source_bucket,
				        source_key,
				        source_etag,
				        source_format,
				        output_prefix,
				        ready_marker_key,
				        status,
				        created_at,
				        updated_at,
				        visibility,
				        review_state,
				        review_prefix,
				        review_revision_id,
				        review_payload_video_id,
				        review_last_error
				   FROM studio_recordings
				  WHERE session_id = ?
				  ORDER BY created_at DESC, updated_at DESC`,
			)
			.bind(sessionId)
			.all<StudioRecordingRow>());
	} catch (error) {
		if (isMissingStudioRecordingsTableError(error)) return [];
		throw error;
	}

	const recordings = (results ?? []).map(rowToRecording);
	return await Promise.all(recordings.map(async (recording) => {
		const transcode = await getTranscodeStatus(env, recording);
		return {
			...recording,
			status: deriveRecordingStatus(
				recording.handoffStatus,
				transcode,
				recording.reviewState,
			),
			transcode,
		};
	}));
}

export async function userCanManageStudioSession(
	env: StudioEnv | undefined,
	session: StudioSessionRecord,
	user: StudioUser,
): Promise<boolean> {
	if (env && userIsConfiguredStudioOperator(env, user)) return true;
	if (userOwnsStudioSession(session, user)) return true;

	const db = getDb(env);
	if (!db) return false;

	const row = await db
		.prepare(
			`SELECT role
			   FROM studio_participants
			  WHERE session_id = ?
			    AND (user_id = ? OR github_handle = ?)
			    AND role IN ('host', 'producer', 'program')
			  LIMIT 1`,
		)
		.bind(session.id, getStudioUserId(user), getStudioUserGithubHandle(user))
		.first<{ role: StudioRole }>();

	return Boolean(row);
}

export function userCanJoinStudioSessionAsGuest(
	session: StudioSessionRecord,
	user: StudioUser,
): boolean {
	return userIsListedOnStudioSession(session, user);
}

export async function saveStudioSession(
	env: StudioEnv,
	session: StudioSessionRecord,
): Promise<void> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to persist Studio sessions");
	}

	await db
		.prepare(
			`INSERT INTO studio_sessions (
				id,
				content_video_id,
				content_video_slug,
				title,
				show_id,
				show_title,
				content_hosts_json,
				content_guests_json,
				starts_at,
				status,
				recording_status,
				realtimekit_meeting_id,
				recording_prefix,
				stream_environment,
				stream_status,
				cloudflare_stream_live_input_id,
				cloudflare_stream_playback_url,
				stream_started_at,
				stream_ended_at,
				stream_notification_queued_at,
				created_by_id,
				created_by_github,
				created_at,
				updated_at,
				review_required
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				content_video_id = excluded.content_video_id,
				content_video_slug = excluded.content_video_slug,
				title = excluded.title,
				show_id = excluded.show_id,
				show_title = excluded.show_title,
				content_hosts_json = excluded.content_hosts_json,
				content_guests_json = excluded.content_guests_json,
				starts_at = excluded.starts_at,
				status = CASE
					WHEN studio_sessions.status <> 'scheduled' THEN studio_sessions.status
					ELSE excluded.status
				END,
				recording_status = CASE
					WHEN studio_sessions.recording_status <> 'idle' THEN studio_sessions.recording_status
					ELSE excluded.recording_status
				END,
				realtimekit_meeting_id = excluded.realtimekit_meeting_id,
				recording_prefix = excluded.recording_prefix,
				stream_environment = CASE
					WHEN studio_sessions.stream_status IN ('idle', 'ended', 'failed')
						THEN excluded.stream_environment
					ELSE studio_sessions.stream_environment
				END,
				stream_status = studio_sessions.stream_status,
				cloudflare_stream_live_input_id = studio_sessions.cloudflare_stream_live_input_id,
				cloudflare_stream_playback_url = studio_sessions.cloudflare_stream_playback_url,
				stream_started_at = studio_sessions.stream_started_at,
				stream_ended_at = studio_sessions.stream_ended_at,
				stream_notification_queued_at = studio_sessions.stream_notification_queued_at,
				review_required = studio_sessions.review_required,
				updated_at = excluded.updated_at`,
		)
		.bind(
			session.id,
			session.contentVideoId,
			session.contentVideoSlug,
			session.title,
			session.showId,
			session.show,
			stringifyPeopleJson(session.hosts),
			stringifyPeopleJson(session.guests),
			session.startsAt,
			session.status,
			session.recordingStatus,
			session.realtimeKitMeetingId,
			session.recordingPrefix,
			session.streamEnvironment,
			session.streamStatus,
			session.cloudflareStreamLiveInputId,
			session.cloudflareStreamPlaybackUrl,
			session.streamStartedAt,
			session.streamEndedAt,
			session.streamNotificationQueuedAt,
			session.createdById,
			session.createdByGithub,
			session.createdAt,
			session.updatedAt,
			session.reviewRequired ? 1 : 0,
		)
		.run();
}

// Turning review off is only allowed while the session has no recording, so a
// review take can never become a public one after the fact.
export async function saveStudioSessionReviewRequired(
	env: StudioEnv,
	sessionId: string,
	reviewRequired: boolean,
): Promise<boolean> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to persist Studio sessions");
	}
	const result = await db
		.prepare(
			`UPDATE studio_sessions
			    SET review_required = ?,
			        updated_at = unixepoch()
			  WHERE id = ?
			    AND (? = 1 OR NOT EXISTS (
			          SELECT 1 FROM studio_recordings WHERE studio_recordings.session_id = studio_sessions.id
			        ))`,
		)
		.bind(reviewRequired ? 1 : 0, sessionId, reviewRequired ? 1 : 0)
		.run();
	return d1WriteChanged(result);
}

export async function countStudioRecordings(
	env: StudioEnv,
	sessionId: string,
): Promise<number> {
	const db = getDb(env);
	if (!db) return 0;
	const row = await db
		.prepare("SELECT count(*) AS total FROM studio_recordings WHERE session_id = ?")
		.bind(sessionId)
		.first<{ total: number }>();
	return row?.total ?? 0;
}

export async function getStudioReviewRecording(
	env: StudioEnv,
	recordingId: string,
): Promise<StudioReviewRecordingRow | null> {
	const db = getDb(env);
	if (!db) return null;
	return await db
		.prepare("SELECT * FROM studio_recordings WHERE recording_id = ?")
		.bind(recordingId)
		.first<StudioReviewRecordingRow>();
}

// A public marker must never leak HLS for a video that is still under client review.
// Only takes that can still become public block: a promoted take is already public,
// a withdrawn take never will be, and a failed take that used every transcode
// attempt is parked until an operator withdraws it (it still blocks until then).
export async function hasUnpromotedReviewRecording(
	env: StudioEnv,
	videoId: string,
): Promise<boolean> {
	const db = getDb(env);
	if (!db) return false;
	const row = await db
		.prepare(
			`SELECT recording_id
			   FROM studio_recordings
			  WHERE video_id = ?
			    AND visibility = 'review'
			    AND (review_state IS NULL OR review_state NOT IN ('promoted', 'withdrawn'))
			  LIMIT 1`,
		)
		.bind(videoId)
		.first<{ recording_id: string }>();
	return Boolean(row);
}

export async function saveStudioSessionRecordingStatus(
	env: StudioEnv,
	sessionId: string,
	status: RecordingStatus,
): Promise<void> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to persist Studio recording status");
	}

	await db
		.prepare(
			`UPDATE studio_sessions
			    SET recording_status = ?,
			        updated_at = unixepoch()
			  WHERE id = ?`,
		)
		.bind(status, sessionId)
		.run();
}

export async function saveStudioSessionStatus(
	env: StudioEnv,
	sessionId: string,
	status: StudioSessionStatus,
): Promise<void> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to persist Studio session status");
	}

	await db
		.prepare(
			`UPDATE studio_sessions
			    SET status = ?,
			        updated_at = unixepoch()
			  WHERE id = ?`,
		)
		.bind(status, sessionId)
		.run();
}

export async function saveStudioStreamStart(
	env: StudioEnv,
	input: {
		liveInputId: string;
		playbackUrl: string;
		sessionId: string;
		startToken: string;
	},
): Promise<boolean> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to persist Studio stream status");
	}

	const result = await db
		.prepare(
			`UPDATE studio_sessions
			    SET stream_status = 'starting',
			        cloudflare_stream_live_input_id = ?,
			        cloudflare_stream_playback_url = ?,
			        stream_started_at = NULL,
			        stream_ended_at = NULL,
			        updated_at = unixepoch()
			  WHERE id = ?
			    AND stream_status = 'starting'
			    AND stream_start_token = ?`,
		)
		.bind(input.liveInputId, input.playbackUrl, input.sessionId, input.startToken)
		.run();
	return d1WriteChanged(result);
}

export async function claimStudioStreamStart(
	env: StudioEnv,
	sessionId: string,
	startToken: string,
): Promise<boolean> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to claim Studio stream start");
	}

	const result = await db
		.prepare(
			`UPDATE studio_sessions
			    SET stream_status = 'starting',
			        stream_start_token = ?,
			        stream_started_at = NULL,
			        stream_ended_at = NULL,
			        updated_at = unixepoch()
			  WHERE id = ?
			    AND status <> 'complete'
			    AND stream_status NOT IN ('starting', 'live')
			    AND (stream_start_token IS NULL OR stream_start_token <> ?)
			    AND (
			      stream_environment <> 'prod'
			      OR NOT EXISTS (
			        SELECT 1 FROM studio_sessions AS active
			         WHERE active.id <> studio_sessions.id
			           AND active.stream_environment = 'prod'
			           AND active.stream_status IN ('starting', 'live')
			      )
			    )`,
		)
		.bind(startToken, sessionId, startToken)
		.run();
	return d1WriteChanged(result);
}

export async function saveStudioStreamLive(
	env: StudioEnv,
	input: {
		playbackUrl: string;
		publicLive: boolean;
		sessionId: string;
		startToken: string;
	},
): Promise<boolean> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to persist Studio stream status");
	}

	const result = await db
		.prepare(
			`UPDATE studio_sessions
			    SET status = CASE WHEN ? = 1 THEN 'live' ELSE status END,
			        stream_status = 'live',
			        cloudflare_stream_playback_url = ?,
			        stream_started_at = CASE
			          WHEN stream_status = 'live' THEN stream_started_at
			          ELSE unixepoch()
			        END,
			        stream_ended_at = NULL,
			        updated_at = unixepoch()
			  WHERE id = ?
			    AND stream_status = 'starting'
			    AND stream_start_token = ?`,
		)
		.bind(
			input.publicLive ? 1 : 0,
			input.playbackUrl,
			input.sessionId,
			input.startToken,
		)
		.run();
	return d1WriteChanged(result);
}

export async function claimStudioStreamNotification(
	env: StudioEnv,
	sessionId: string,
	notificationQueuedAt: number,
): Promise<boolean> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to claim Studio stream notification");
	}

	const result = await db
		.prepare(
			`UPDATE studio_sessions
			    SET stream_notification_queued_at = ?,
			        updated_at = unixepoch()
			  WHERE id = ?
			    AND stream_environment = 'prod'
			    AND stream_status = 'live'
			    AND status = 'live'
			    AND stream_notification_queued_at IS NULL`,
		)
		.bind(notificationQueuedAt, sessionId)
		.run();
	return d1WriteChanged(result);
}

export async function releaseStudioStreamNotificationClaim(
	env: StudioEnv,
	sessionId: string,
	notificationQueuedAt: number,
): Promise<void> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to release Studio stream notification claim");
	}

	await db
		.prepare(
			`UPDATE studio_sessions
			    SET stream_notification_queued_at = NULL,
			        updated_at = unixepoch()
			  WHERE id = ?
			    AND stream_notification_queued_at = ?`,
		)
		.bind(sessionId, notificationQueuedAt)
		.run();
}

function d1WriteChanged(result: D1Result<unknown>): boolean {
	return (result.meta?.changes ?? result.meta?.rows_written ?? 0) > 0;
}

export async function saveStudioStreamEnded(
	env: StudioEnv,
	sessionId: string,
	startToken?: string,
): Promise<void> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to persist Studio stream status");
	}

	if (startToken) {
		await db
			.prepare(
				`UPDATE studio_sessions
				    SET status = CASE WHEN status = 'live' THEN 'scheduled' ELSE status END,
				        stream_status = 'ended',
				        stream_start_token = CASE
				          WHEN stream_start_token = ? THEN NULL
				          ELSE ?
				        END,
				        stream_ended_at = COALESCE(stream_ended_at, unixepoch()),
				        updated_at = unixepoch()
				  WHERE id = ?
				    AND (
				      stream_start_token = ?
				      OR (
				        stream_start_token IS NULL
				        AND stream_status NOT IN ('starting', 'live')
				      )
				    )`,
			)
			.bind(startToken, startToken, sessionId, startToken)
			.run();
		return;
	}

	await db
		.prepare(
			`UPDATE studio_sessions
			    SET status = CASE WHEN status = 'live' THEN 'scheduled' ELSE status END,
			        stream_status = 'ended',
			        stream_start_token = NULL,
			        stream_ended_at = COALESCE(stream_ended_at, unixepoch()),
			        updated_at = unixepoch()
			  WHERE id = ?`,
		)
		.bind(sessionId)
		.run();
}

export function buildStudioSession(input: {
	contentVideoId?: string | null;
	contentVideoSlug?: string | null;
	createdBy: StudioUser;
	guests?: StudioPersonSummary[];
	hosts?: StudioPersonSummary[];
	meeting: RealtimeKitMeeting | null;
	sessionId?: string;
	show: string;
	showId?: string;
	startsAt?: string;
	status?: StudioSessionStatus;
	streamEnvironment?: StreamEnvironment;
	reviewRequired?: boolean;
	title: string;
}): StudioSessionRecord {
	const createdAt = nowSeconds();
	const sessionId = input.sessionId ?? createStudioSessionId(input.show);
	const createdByGithub = getStudioUserGithubHandle(input.createdBy);
	const createdByHost = {
		id: getStudioUserId(input.createdBy),
		name: input.createdBy.name || createdByGithub || "Studio host",
		githubHandle: createdByGithub,
	};
	return {
		id: sessionId,
		contentVideoId: input.contentVideoId ?? null,
		contentVideoSlug: input.contentVideoSlug ?? null,
		title: input.title,
		show: input.show,
		showId: input.showId ?? (slugify(input.show) || "studio"),
		startsAt: input.startsAt ?? new Date().toISOString(),
		status: input.status ?? "scheduled",
		hosts: mergePeople(input.hosts ?? [], [createdByHost]),
		guests: input.guests ?? [],
		recordingStatus: "idle",
		realtimeKitMeetingId: input.meeting?.id ?? null,
		recordingPrefix: `studio/recordings/${sessionId}/`,
		streamEnvironment: input.streamEnvironment ?? "test",
		streamStatus: "idle",
		cloudflareStreamLiveInputId: null,
		cloudflareStreamPlaybackUrl: null,
		streamStartedAt: null,
		streamEndedAt: null,
		streamNotificationQueuedAt: null,
		reviewRequired: input.reviewRequired ?? false,
		createdById: getStudioUserId(input.createdBy),
		createdByGithub,
		createdAt,
		updatedAt: createdAt,
	};
}

export async function upsertStudioParticipant(
	env: StudioEnv,
	input: {
		person?: StudioPersonSummary | null;
		sessionId: string;
		user: StudioUser;
		role: StudioRole;
	},
): Promise<void> {
	const db = getDb(env);
	if (!db) return;

	await db
		.prepare(
			`INSERT INTO studio_participants (
				session_id,
				user_id,
				github_handle,
				role,
				name,
				image_url,
				joined_at
			)
			VALUES (?, ?, ?, ?, ?, ?, unixepoch())
			ON CONFLICT(session_id, user_id, role) DO UPDATE SET
				github_handle = excluded.github_handle,
				name = excluded.name,
				image_url = excluded.image_url,
				joined_at = excluded.joined_at`,
		)
		.bind(
			input.sessionId,
			getStudioUserId(input.user),
			input.person?.githubHandle ?? getStudioUserGithubHandle(input.user),
			input.role,
			input.person?.name ||
				input.user.name ||
				getStudioUserGithubHandle(input.user) ||
				"Studio participant",
			input.person?.avatarUrl ?? input.user.image,
		)
		.run();
}

export async function createStudioInviteRecord(
	env: StudioEnv,
	input: {
		createdBy: StudioUser;
		expiresAt: number;
		maxUses: number;
		role: StudioRole;
		sessionId: string;
		tokenHash: string;
	},
): Promise<StudioInvite> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to persist Studio invites");
	}

	const createdAt = nowSeconds();
	await db
		.prepare(
			`INSERT INTO studio_invites (
				token_hash,
				session_id,
				role,
				expires_at,
				max_uses,
				used_count,
				created_by_id,
				created_by_github,
				created_at,
				revoked_at
			)
			VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, NULL)`,
		)
		.bind(
			input.tokenHash,
			input.sessionId,
			input.role,
			input.expiresAt,
			input.maxUses,
			getStudioUserId(input.createdBy),
			getStudioUserGithubHandle(input.createdBy),
			createdAt,
		)
		.run();

	return {
		tokenHash: input.tokenHash,
		sessionId: input.sessionId,
		role: input.role,
		expiresAt: input.expiresAt,
		maxUses: input.maxUses,
		usedCount: 0,
		createdById: getStudioUserId(input.createdBy),
		createdByGithub: getStudioUserGithubHandle(input.createdBy),
		createdAt,
		revokedAt: null,
	};
}

export async function resolveStudioInvite(
	env: StudioEnv | undefined,
	token: string,
	user?: StudioUser,
): Promise<ResolvedStudioInvite | null> {
	const db = getDb(env);
	if (!db || token === "demo") {
		if (token !== "demo") return null;
		const session = fallbackSession();
		return {
			invite: {
				tokenHash: "demo",
				sessionId: session.id,
				role: "guest",
				expiresAt: nowSeconds() + 60 * 60,
				maxUses: 0,
				usedCount: 0,
				createdById: "seed",
				createdByGithub: "rawkode",
				createdAt: session.createdAt,
				revokedAt: null,
			},
			session,
		};
	}

	const tokenHash = await hashInviteToken(token);
	const userId = user ? getStudioUserId(user) : "";
	let row: StudioInviteRow | null = null;
	try {
		row = await db
			.prepare(
				`SELECT token_hash,
			        session_id,
			        role,
			        expires_at,
			        max_uses,
			        used_count,
			        created_by_id,
			        created_by_github,
			        created_at,
			        revoked_at
			   FROM studio_invites
			  WHERE token_hash = ?
			    AND revoked_at IS NULL
			    AND expires_at > unixepoch()
			    AND (
			      max_uses = 0
			      OR used_count < max_uses
			      OR EXISTS (
			          SELECT 1
			            FROM studio_invite_redemptions
			           WHERE studio_invite_redemptions.token_hash = studio_invites.token_hash
			             AND studio_invite_redemptions.user_id = ?
			        )
			    )
			  LIMIT 1`,
			)
			.bind(tokenHash, userId)
			.first<StudioInviteRow>();
	} catch (error) {
		if (import.meta.env.DEV && isMissingStudioInviteTableError(error)) {
			return null;
		}
		throw error;
	}
	if (!row) return null;

	const session = await getStudioSession(env, row.session_id);
	if (!session) return null;

	return {
		invite: rowToInvite(row),
		session,
	};
}

export async function redeemStudioInvite(
	env: StudioEnv,
	invite: StudioInvite,
	user: StudioUser,
): Promise<boolean> {
	const db = getDb(env);
	if (!db || invite.tokenHash === "demo") return true;

	const existing = await db
		.prepare(
			`SELECT user_id
			   FROM studio_invite_redemptions
			  WHERE token_hash = ?
			    AND user_id = ?
			  LIMIT 1`,
		)
		.bind(invite.tokenHash, getStudioUserId(user))
		.first<{ user_id: string }>();
	if (existing) return true;

	const update = await db
		.prepare(
			`UPDATE studio_invites
			    SET used_count = used_count + 1
			  WHERE token_hash = ?
			    AND revoked_at IS NULL
			    AND expires_at > unixepoch()
			    AND (max_uses = 0 OR used_count < max_uses)`,
		)
		.bind(invite.tokenHash)
		.run();
	const updateMeta = update.meta as {
		changes?: number;
		rows_written?: number;
	};
	if ((updateMeta.changes ?? updateMeta.rows_written ?? 0) < 1) {
		return false;
	}

	await db
		.prepare(
			`INSERT INTO studio_invite_redemptions (
				token_hash,
				user_id,
				github_handle,
				redeemed_at
			)
			VALUES (?, ?, ?, unixepoch())
			ON CONFLICT(token_hash, user_id) DO NOTHING`,
		)
		.bind(invite.tokenHash, getStudioUserId(user), getStudioUserGithubHandle(user))
		.run();

	return true;
}

// Contract v2 review handoff. The row records the pinned source size and the ready
// marker's etag, which later retriggers and the promotion write conditionally on.
export async function saveReviewRecordingMarker(
	env: StudioEnv,
	marker: StudioRecordingReviewMarker,
	options: { requestedBy: string | null },
): Promise<{ readyMarkerKey: string; sourceVerified: boolean }> {
	const db = getDb(env);
	if (!db || !env.RECORDINGS) {
		throw new Error("STUDIO_DB and RECORDINGS are required for review recordings");
	}
	const readyMarkerKey = createReadyMarkerKey(
		marker.studioSessionId,
		marker.recordingId,
	);
	const source = await env.RECORDINGS.head(marker.sourceKey);
	if (!source) {
		throw new Error(`Recording source missing from R2: ${marker.sourceKey}`);
	}
	if (normalizeEtag(source.etag) !== normalizeEtag(marker.sourceEtag)) {
		throw new Error(
			`Recording source etag mismatch for ${marker.sourceKey}: expected ${marker.sourceEtag}, got ${source.etag}`,
		);
	}

	await db
		.prepare(
			`INSERT INTO studio_recordings (
				recording_id,
				session_id,
				video_id,
				source_bucket,
				source_key,
				source_etag,
				source_format,
				output_prefix,
				ready_marker_key,
				status,
				visibility,
				source_bytes,
				review_prefix,
				review_idempotency_key,
				review_state,
				review_requested_by,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'marker-pending', 'review', ?, ?, ?, 'pending', ?, unixepoch(), unixepoch())
			ON CONFLICT(recording_id) DO UPDATE SET
				status = 'marker-pending',
				updated_at = excluded.updated_at
			WHERE studio_recordings.visibility = 'review'
			  AND studio_recordings.review_state = 'pending'
			  AND studio_recordings.source_etag = excluded.source_etag`,
		)
		.bind(
			marker.recordingId,
			marker.studioSessionId,
			marker.videoId,
			marker.sourceBucket,
			marker.sourceKey,
			normalizeEtag(marker.sourceEtag),
			marker.sourceFormat,
			marker.outputPrefix,
			readyMarkerKey,
			source.size,
			marker.outputPrefix,
			createReviewIdempotencyKey(
				marker.studioSessionId,
				marker.recordingId,
				marker.sourceEtag,
			),
			options.requestedBy,
		)
		.run();
	const saved = await getStudioReviewRecording(env, marker.recordingId);
	if (
		saved?.visibility !== "review" ||
		saved.review_state !== "pending" ||
		normalizeEtag(saved.source_etag) !== normalizeEtag(marker.sourceEtag)
	) {
		throw new Error(`Recording ${marker.recordingId} was already handed off`);
	}

	const written = await env.RECORDINGS.put(
		readyMarkerKey,
		JSON.stringify(marker, null, 2),
		{ httpMetadata: { contentType: "application/json" } },
	);

	await db
		.prepare(
			`UPDATE studio_recordings
			    SET status = 'ready',
			        review_marker_etag = ?,
			        review_last_error = NULL,
			        updated_at = unixepoch()
			  WHERE recording_id = ?
			    AND visibility = 'review'
			    AND review_state = 'pending'`,
		)
		.bind(written ? normalizeEtag(written.etag) : null, marker.recordingId)
		.run();
	await saveStudioSessionRecordingStatus(env, marker.studioSessionId, "uploaded");

	return { readyMarkerKey, sourceVerified: true };
}

export class StudioRecordingConflictError extends Error {}

export async function saveRecordingReadyMarker(
	env: StudioEnv,
	marker: StudioRecordingReadyMarker,
): Promise<{ readyMarkerKey: string; sourceVerified: boolean }> {
	const readyMarkerKey = createReadyMarkerKey(
		marker.studioSessionId,
		marker.recordingId,
	);
	const source = env.RECORDINGS
		? await env.RECORDINGS.head(marker.sourceKey)
		: null;
	if (env.RECORDINGS && !source) {
		throw new Error(`Recording source missing from R2: ${marker.sourceKey}`);
	}
	if (source && normalizeEtag(source.etag) !== normalizeEtag(marker.sourceEtag)) {
		throw new Error(
			`Recording source etag mismatch for ${marker.sourceKey}: expected ${marker.sourceEtag}, got ${source.etag}`,
		);
	}

	const db = getDb(env);
	if (db) {
		const upserted = await db
			.prepare(
				`INSERT INTO studio_recordings (
					recording_id,
					session_id,
					video_id,
					source_bucket,
					source_key,
					source_etag,
					source_format,
					output_prefix,
					ready_marker_key,
					status,
					created_at,
					updated_at
				)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'marker-pending', unixepoch(), unixepoch())
				ON CONFLICT(recording_id) DO UPDATE SET
					session_id = excluded.session_id,
					video_id = excluded.video_id,
					source_bucket = excluded.source_bucket,
					source_key = excluded.source_key,
					source_etag = excluded.source_etag,
					source_format = excluded.source_format,
					output_prefix = excluded.output_prefix,
					ready_marker_key = excluded.ready_marker_key,
					status = 'marker-pending',
					updated_at = excluded.updated_at
				WHERE studio_recordings.visibility = 'public'
				  AND studio_recordings.session_id = excluded.session_id`,
			)
			.bind(
				marker.recordingId,
				marker.studioSessionId,
				marker.videoId,
				marker.sourceBucket,
				marker.sourceKey,
				marker.sourceEtag,
				marker.sourceFormat,
				marker.outputPrefix,
				readyMarkerKey,
			)
			.run();
		// A recording ID owned by another session, or by a review take, is never
		// taken over by a public marker: the guarded upsert writes nothing.
		if ((upserted.meta?.changes ?? 1) === 0) {
			throw new StudioRecordingConflictError(
				`Recording ${marker.recordingId} belongs to another session or review take`,
			);
		}
	}

	if (env.RECORDINGS) {
		await env.RECORDINGS.put(readyMarkerKey, JSON.stringify(marker, null, 2), {
			httpMetadata: { contentType: "application/json" },
		});
	}

	if (db) {
		await db
			.prepare(
				`UPDATE studio_recordings
				    SET status = 'ready',
				        updated_at = unixepoch()
				  WHERE recording_id = ?`,
			)
			.bind(marker.recordingId)
			.run();

		await saveStudioSessionRecordingStatus(env, marker.studioSessionId, "uploaded");
	}

	return { readyMarkerKey, sourceVerified: Boolean(source) };
}

export async function loadStudioDashboard(
	user: StudioUser | undefined,
	env?: StudioEnv,
): Promise<StudioDashboard> {
	if (!user) {
		return {
			contentError: null,
			events: [],
			isOperator: false,
			user: null,
			sessions: [],
		};
	}

	const isOperator = env ? userIsConfiguredStudioOperator(env, user) : false;
	const [{ error: contentError, events: contentEvents }, allSessions] =
		await Promise.all([
			loadContentEvents(env, { upcomingOnly: isOperator }),
			listStudioSessions(env),
		]);
	const sessionsByContentVideoId = groupSessionsByContentVideoId(allSessions);
	const visibleEvents = isOperator
		? contentEvents.filter((event) => isUpcomingEvent(event))
		: contentEvents.filter((event) => contentEventIncludesUser(event, user));
	const events = visibleEvents.map((event) =>
		contentVideoToEvent(
			event,
			sortSessionsForEvent(sessionsByContentVideoId.get(event.id) ?? []),
		)
	);

	return {
		contentError,
		events,
		isOperator,
		user,
		sessions: isOperator
			? allSessions
			: allSessions.filter((session) => userIsListedOnStudioSession(session, user)),
	};
}
