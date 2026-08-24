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
	| "vod-ready";
export type StreamEnvironment = "prod" | "test";
export type StudioStreamStatus = "ended" | "failed" | "idle" | "live" | "starting";
export type StudioSessionStatus = "scheduled" | "live" | "recording" | "complete";

export const studioRecordingHeartbeatIntervalMs = 30_000;
export const studioRecordingLeaseTimeoutSeconds = 120;

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
}

export interface StudioSessionRecord extends StudioSessionSummary {
	showId: string;
	createdById: string;
	createdByGithub: string | null;
	createdAt: number;
	updatedAt: number;
}

export interface StudioStreamLease {
	startToken: string | null;
	status: StudioStreamStatus;
}

export interface StudioParticipantProviderIdentity {
	realtimeKitParticipantId: string | null;
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

export class StudioRecordingOutputClaimedError extends Error {
	constructor() {
		super("A canonical Studio recording already exists for this content video.");
		this.name = "StudioRecordingOutputClaimedError";
	}
}

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
	return `recording-${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID()}`;
}

export function createReadyMarkerKey(
	sessionId: string,
	recordingId: string,
): string {
	return `studio/recordings/${sessionId}/${recordingId}/ready.json`;
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

function developmentFallbacksEnabled(env: StudioEnv | undefined): boolean {
	const runtimeOverride = (
		env as (StudioEnv & { STUDIO_RUNTIME_MODE?: unknown }) | undefined
	)?.STUDIO_RUNTIME_MODE;
	if (runtimeOverride === "production") return false;
	return import.meta.env.DEV;
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

function normalizeEtag(value: string): string {
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

function canonicalVodKeys(videoId: string): {
	statusKey: string;
	streamKey: string;
} {
	const outputPrefix = `videos/${videoId}/`;
	return {
		statusKey: `${outputPrefix}transcode-status.json`,
		streamKey: `${outputPrefix}stream.m3u8`,
	};
}

export async function hasCanonicalStudioVodOutput(
	env: StudioEnv,
	videoId: string,
): Promise<boolean> {
	if (!env.RECORDINGS) return false;
	const { statusKey, streamKey } = canonicalVodKeys(videoId);
	const [status, stream] = await Promise.all([
		env.RECORDINGS.head(statusKey),
		env.RECORDINGS.head(streamKey),
	]);
	return Boolean(status || stream);
}

async function assertCanonicalVodOutputAvailableForMarker(
	env: StudioEnv,
	marker: StudioRecordingReadyMarker,
): Promise<void> {
	if (!env.RECORDINGS) return;
	const { statusKey, streamKey } = canonicalVodKeys(marker.videoId);
	const [statusHead, streamObject] = await Promise.all([
		env.RECORDINGS.head(statusKey),
		env.RECORDINGS.head(streamKey),
	]);
	if (!statusHead && !streamObject) return;
	if (!statusHead) throw new StudioRecordingOutputClaimedError();
	const statusObject = await env.RECORDINGS.get(statusKey);
	if (!statusObject) throw new StudioRecordingOutputClaimedError();

	const status = (await statusObject.json().catch(() => null)) as Partial<
		StudioRecordingReadyMarker
	> | null;
	if (
		!status ||
		status.videoId !== marker.videoId ||
		status.studioSessionId !== marker.studioSessionId ||
		status.recordingId !== marker.recordingId ||
		status.sourceBucket !== marker.sourceBucket ||
		status.sourceKey !== marker.sourceKey ||
		status.sourceEtag !== marker.sourceEtag ||
		status.sourceFormat !== marker.sourceFormat ||
		status.outputPrefix !== marker.outputPrefix
	) {
		throw new StudioRecordingOutputClaimedError();
	}
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
		status: deriveRecordingStatus(row.status, null),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		transcode: null,
	};
}

async function getTranscodeStatus(
	env: StudioEnv | undefined,
	recording: StudioRecordingSummary,
	studioSessionId: string,
): Promise<StudioTranscodeStatus | null> {
	if (!env?.RECORDINGS) {
		return null;
	}

	const outputPrefix = normalizeOutputPrefix(recording.outputPrefix);
	const statusKey = `${outputPrefix}transcode-status.json`;
	const object = await env.RECORDINGS.get(statusKey).catch(() => null);
	if (!object) {
		return null;
	}

	const status = (await object.json().catch(() => null)) as {
		completedAt?: string;
		outputPrefix?: string;
		recordingId?: string;
		sourceBucket?: string;
		sourceEtag?: string;
		sourceFormat?: string;
		sourceKey?: string;
		status?: string;
		studioSessionId?: string;
		videoId?: string;
	} | null;
	if (
		!status?.status ||
		status.videoId !== recording.videoId ||
		status.studioSessionId !== studioSessionId ||
		status.recordingId !== recording.recordingId ||
		status.sourceBucket !== recording.sourceBucket ||
		status.sourceKey !== recording.sourceKey ||
		status.sourceEtag !== recording.sourceEtag ||
		status.sourceFormat !== recording.sourceFormat ||
		status.outputPrefix !== recording.outputPrefix
	) {
		return null;
	}

	return {
		completedAt: status.completedAt ?? null,
		status: status.status,
		statusKey,
		streamUrl:
			status.status === "complete"
				? `https://content.rawkode.academy/${outputPrefix}stream.m3u8`
				: null,
	};
}

function deriveRecordingStatus(
	handoffStatus: string,
	transcode: StudioTranscodeStatus | null,
): RecordingStatus {
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

async function deriveStudioRecordingSummary(
	env: StudioEnv | undefined,
	row: StudioRecordingRow,
): Promise<StudioRecordingSummary> {
	const recording = rowToRecording(row);
	const transcode = await getTranscodeStatus(env, recording, row.session_id);
	return {
		...recording,
		status: deriveRecordingStatus(recording.handoffStatus, transcode),
		transcode,
	};
}

async function getLatestStudioRecording(
	env: StudioEnv | undefined,
	sessionId: string,
): Promise<StudioRecordingSummary | null> {
	const db = getDb(env);
	if (!db) return null;

	let row: StudioRecordingRow | null;
	try {
		row = await db
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
				        updated_at
				   FROM studio_recordings
				  WHERE session_id = ?
				  ORDER BY created_at DESC, updated_at DESC
				  LIMIT 1`,
			)
			.bind(sessionId)
			.first<StudioRecordingRow>();
	} catch (error) {
		if (isMissingStudioRecordingsTableError(error)) return null;
		throw error;
	}
	return row ? await deriveStudioRecordingSummary(env, row) : null;
}

async function getDerivedSessionRecordingStatus(
	env: StudioEnv | undefined,
	session: StudioSessionRecord,
): Promise<RecordingStatus> {
	if (session.recordingStatus === "recording") {
		return session.recordingStatus;
	}

	const latestRecording = await getLatestStudioRecording(env, session.id);
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
	if (!db) return developmentFallbacksEnabled(env) ? [fallbackSession()] : [];

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
				        created_by_id,
				        created_by_github,
				        created_at,
				        updated_at
				   FROM studio_sessions
				  ORDER BY CASE
				             WHEN status IN ('live', 'recording')
				               OR stream_status IN ('starting', 'live')
				               OR recording_status = 'recording' THEN 0
				             WHEN status <> 'complete' THEN 1
				             ELSE 2
				           END ASC,
				           CASE WHEN status <> 'complete' THEN starts_at END ASC,
				           CASE WHEN status = 'complete'
				             THEN COALESCE(stream_ended_at, updated_at, created_at)
				           END DESC,
				           updated_at DESC,
				           created_at DESC
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
		if (!developmentFallbacksEnabled(env)) return [];
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
				  ORDER BY CASE
				             WHEN status IN ('live', 'recording')
				               OR stream_status IN ('starting', 'live')
				               OR recording_status = 'recording' THEN 0
				             WHEN status <> 'complete' THEN 1
				             ELSE 2
				           END ASC,
				           CASE WHEN status <> 'complete' THEN starts_at END ASC,
				           CASE WHEN status = 'complete'
				             THEN COALESCE(stream_ended_at, updated_at, created_at)
				           END DESC,
				           updated_at DESC,
				           created_at DESC
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
		if (!developmentFallbacksEnabled(env)) return null;
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

	return row ? rowToSession(row) : null;
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
				        created_by_id,
				        created_by_github,
				        created_at,
				        updated_at
				   FROM studio_sessions
				  WHERE content_video_slug = ?
				    AND stream_environment = 'prod'
				    AND stream_status = 'live'
				    AND status = 'live'
				    AND stream_heartbeat_at IS NOT NULL
				    AND stream_heartbeat_at >= unixepoch() - 20
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
				        updated_at
				   FROM studio_recordings
				  WHERE session_id = ?
				  ORDER BY created_at DESC, updated_at DESC
				  LIMIT 50`,
			)
			.bind(sessionId)
			.all<StudioRecordingRow>());
	} catch (error) {
		if (isMissingStudioRecordingsTableError(error)) return [];
		throw error;
	}

	return await Promise.all(
		(results ?? []).map((row) => deriveStudioRecordingSummary(env, row)),
	);
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
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
		)
		.run();
}

export async function saveStudioSessionStatus(
	env: StudioEnv,
	sessionId: string,
	status: StudioSessionStatus,
): Promise<boolean> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to persist Studio session status");
	}

	const result = await db
		.prepare(
			`UPDATE studio_sessions
			    SET status = ?,
			        updated_at = unixepoch()
			  WHERE id = ?
			    AND (
			      ? <> 'complete'
			      OR NOT (
			        recording_status = 'recording'
			        AND (
			          (
			            recording_lease_id IS NOT NULL
			            AND recording_heartbeat_at IS NOT NULL
			            AND recording_heartbeat_at >= unixepoch() - ${studioRecordingLeaseTimeoutSeconds}
			          )
			          OR (
			            recording_lease_id IS NULL
			            AND recording_lease_grace_until IS NOT NULL
			            AND recording_lease_grace_until > unixepoch()
			          )
			        )
			      )
			    )`,
		)
		.bind(status, sessionId, status)
		.run();
	return d1WriteChanged(result);
}

export async function claimStudioRecordingLease(
	env: StudioEnv,
	sessionId: string,
	recordingId: string,
): Promise<boolean> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to claim Studio recording lease");
	}

	const result = await db
		.prepare(
			`UPDATE studio_sessions
			    SET recording_status = 'recording',
			        recording_lease_id = ?,
			        recording_heartbeat_at = unixepoch(),
			        recording_lease_grace_until = NULL,
			        updated_at = unixepoch()
			  WHERE id = ?
			    AND stream_environment = 'prod'
			    AND content_video_id IS NOT NULL
			    AND (
			      status <> 'complete'
			      OR EXISTS (
			        SELECT 1
			          FROM studio_recordings AS retry
			         WHERE retry.video_id = studio_sessions.content_video_id
			           AND retry.session_id = studio_sessions.id
			           AND retry.recording_id = ?
			      )
			    )
			    AND recording_status <> 'recording'
			    AND recording_lease_id IS NULL
			    AND (
			      NOT EXISTS (
			        SELECT 1
			          FROM studio_recordings AS claimed
			         WHERE claimed.video_id = studio_sessions.content_video_id
			      )
			      OR EXISTS (
			        SELECT 1
			          FROM studio_recordings AS retry
			         WHERE retry.video_id = studio_sessions.content_video_id
			           AND retry.session_id = studio_sessions.id
			           AND retry.recording_id = ?
			      )
			    )
			    AND NOT EXISTS (
			      SELECT 1
			        FROM studio_sessions AS other
			       WHERE other.id <> studio_sessions.id
			         AND other.stream_environment = 'prod'
			         AND other.content_video_id = studio_sessions.content_video_id
			         AND other.recording_status = 'recording'
			         AND (
			           (
			             other.recording_lease_id IS NOT NULL
			             AND other.recording_heartbeat_at >= unixepoch() - ${studioRecordingLeaseTimeoutSeconds}
			           )
			           OR (
			             other.recording_lease_id IS NULL
			             AND other.recording_lease_grace_until > unixepoch()
			           )
			         )
			    )`,
		)
		.bind(recordingId, sessionId, recordingId, recordingId)
		.run();
	return d1WriteChanged(result);
}

export async function hasCanonicalStudioRecording(
	env: StudioEnv,
	sessionId: string,
): Promise<boolean> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to inspect Studio recording claims");
	}

	const row = await db
		.prepare(
			`SELECT 1 AS claimed
			   FROM studio_sessions AS target
			   JOIN studio_recordings AS recording
			     ON recording.video_id = target.content_video_id
			  WHERE target.id = ?
			  LIMIT 1`,
		)
		.bind(sessionId)
		.first<{ claimed: number }>();
	return row?.claimed === 1;
}

export async function renewStudioRecordingLease(
	env: StudioEnv,
	sessionId: string,
	recordingId: string,
): Promise<boolean> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to renew Studio recording lease");
	}

	const result = await db
		.prepare(
			`UPDATE studio_sessions
			    SET recording_lease_id = COALESCE(recording_lease_id, ?),
			        recording_heartbeat_at = unixepoch(),
			        recording_lease_grace_until = NULL,
			        updated_at = unixepoch()
			  WHERE id = ?
			    AND status <> 'complete'
			    AND recording_status = 'recording'
			    AND (
			      (
			        recording_lease_id = ?
			        AND recording_heartbeat_at >= unixepoch() - ${studioRecordingLeaseTimeoutSeconds}
			      )
			      OR (
			        recording_lease_id IS NULL
			        AND recording_lease_grace_until > unixepoch()
			      )
			    )`,
		)
		.bind(recordingId, sessionId, recordingId)
		.run();
	return d1WriteChanged(result);
}

export async function releaseStudioRecordingLease(
	env: StudioEnv,
	input: {
		nextStatus: "idle" | "uploaded";
		recordingId: string;
		sessionId: string;
	},
): Promise<boolean> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to release Studio recording lease");
	}

	const result = await db
		.prepare(
			`UPDATE studio_sessions
			    SET recording_status = ?,
			        recording_lease_id = NULL,
			        recording_heartbeat_at = NULL,
			        recording_lease_grace_until = NULL,
			        updated_at = unixepoch()
			  WHERE id = ?
			    AND recording_lease_id = ?`,
		)
		.bind(input.nextStatus, input.sessionId, input.recordingId)
		.run();
	return d1WriteChanged(result);
}

export async function expireStaleStudioRecordingLeases(
	env: StudioEnv | undefined,
	sessionId?: string,
): Promise<number> {
	const db = getDb(env);
	if (!db) return 0;

	const sessionFilter = sessionId ? " AND id = ?" : "";
	const statement = db.prepare(
		`UPDATE studio_sessions
		    SET recording_status = CASE
		          WHEN recording_status = 'recording' THEN 'idle'
		          ELSE recording_status
		        END,
		        recording_lease_id = NULL,
		        recording_heartbeat_at = NULL,
		        recording_lease_grace_until = NULL,
		        updated_at = unixepoch()
		  WHERE (
		      (
		        recording_lease_id IS NOT NULL
		        AND (
		          recording_heartbeat_at IS NULL
		          OR recording_heartbeat_at < unixepoch() - ${studioRecordingLeaseTimeoutSeconds}
		        )
		      )
		      OR (
		        recording_lease_id IS NULL
		        AND recording_status = 'recording'
			        AND (
			          recording_lease_grace_until IS NULL
			          OR recording_lease_grace_until <= unixepoch()
		        )
		      )
		    )${sessionFilter}`,
	);
	const result = await statement.bind(...(sessionId ? [sessionId] : [])).run();
	return result.meta?.changes ?? result.meta?.rows_written ?? 0;
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
			        stream_heartbeat_at = unixepoch(),
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
			        stream_heartbeat_at = unixepoch(),
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
			        SELECT 1
			          FROM studio_sessions AS other
			         WHERE other.id <> studio_sessions.id
			           AND other.stream_environment = 'prod'
			           AND (
			             other.content_video_id = studio_sessions.content_video_id
			             OR other.content_video_slug = studio_sessions.content_video_slug
			           )
			           AND (
			             (
			               other.stream_status = 'starting'
			               AND other.stream_heartbeat_at >= unixepoch() - 120
			             )
			             OR (
			               other.stream_status = 'live'
			               AND other.stream_heartbeat_at >= unixepoch() - 20
			             )
			           )
			      )
			    )`,
		)
		.bind(startToken, sessionId, startToken)
		.run();
	return d1WriteChanged(result);
}

export async function hasFreshStudioContentStreamConflict(
	env: StudioEnv,
	sessionId: string,
): Promise<boolean> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to inspect Studio content streams");
	}

	const row = await db
		.prepare(
			`SELECT 1 AS conflicting
			   FROM studio_sessions AS target
			   JOIN studio_sessions AS other
			     ON other.id <> target.id
			    AND other.stream_environment = 'prod'
			    AND (
			      other.content_video_id = target.content_video_id
			      OR other.content_video_slug = target.content_video_slug
			    )
			  WHERE target.id = ?
			    AND target.stream_environment = 'prod'
			    AND (
			      (
			        other.stream_status = 'starting'
			        AND other.stream_heartbeat_at >= unixepoch() - 120
			      )
			      OR (
			        other.stream_status = 'live'
			        AND other.stream_heartbeat_at >= unixepoch() - 20
			      )
			    )
			  LIMIT 1`,
		)
		.bind(sessionId)
		.first<{ conflicting: number }>();
	return row?.conflicting === 1;
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
			        stream_heartbeat_at = unixepoch(),
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

export async function saveStudioStreamHeartbeat(
	env: StudioEnv,
	sessionId: string,
	startToken: string,
): Promise<boolean> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to renew Studio stream lease");
	}

	const result = await db
		.prepare(
			`UPDATE studio_sessions
			    SET stream_heartbeat_at = unixepoch(),
			        updated_at = unixepoch()
			  WHERE id = ?
			    AND stream_status IN ('starting', 'live')
			    AND stream_start_token = ?`,
		)
		.bind(sessionId, startToken)
		.run();
	return d1WriteChanged(result);
}

export async function getStudioStreamLease(
	env: StudioEnv,
	sessionId: string,
): Promise<StudioStreamLease | null> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to inspect Studio stream lease");
	}

	const row = await db
		.prepare(
			`SELECT stream_status,
			        stream_start_token
			   FROM studio_sessions
			  WHERE id = ?`,
		)
		.bind(sessionId)
		.first<Pick<StudioSessionRow, "stream_start_token" | "stream_status">>();

	return row
		? {
				startToken: row.stream_start_token,
				status: row.stream_status,
			}
		: null;
}

export async function takeOverStudioStreamLease(
	env: StudioEnv,
	sessionId: string,
	lease: StudioStreamLease,
): Promise<boolean> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to take over Studio stream lease");
	}

	const result = await db
		.prepare(
			`UPDATE studio_sessions
			    SET status = CASE WHEN status = 'live' THEN 'scheduled' ELSE status END,
			        stream_status = 'ended',
			        stream_start_token = NULL,
			        stream_heartbeat_at = NULL,
			        stream_ended_at = COALESCE(stream_ended_at, unixepoch()),
			        updated_at = unixepoch()
			  WHERE id = ?
			    AND stream_status = ?
			    AND stream_start_token IS ?`,
		)
		.bind(sessionId, lease.status, lease.startToken)
		.run();
	return d1WriteChanged(result);
}

export async function expireStaleStudioStreams(
	env: StudioEnv | undefined,
	sessionId?: string,
): Promise<number> {
	const db = getDb(env);
	if (!db) return 0;

	const sessionFilter = sessionId ? " AND id = ?" : "";
	const statement = db.prepare(
		`UPDATE studio_sessions
		    SET status = CASE WHEN status = 'live' THEN 'scheduled' ELSE status END,
		        stream_status = 'ended',
		        stream_start_token = NULL,
		        stream_heartbeat_at = NULL,
		        stream_ended_at = COALESCE(stream_ended_at, unixepoch()),
		        updated_at = unixepoch()
		  WHERE (
		      (
		        stream_status = 'starting'
		        AND (stream_heartbeat_at IS NULL OR stream_heartbeat_at < unixepoch() - 120)
		      )
		      OR (
		        stream_status = 'live'
		        AND (stream_heartbeat_at IS NULL OR stream_heartbeat_at < unixepoch() - 20)
		      )
		    )${sessionFilter}`,
	);
	const result = await statement.bind(...(sessionId ? [sessionId] : [])).run();
	return result.meta?.changes ?? result.meta?.rows_written ?? 0;
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
): Promise<boolean> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to persist Studio stream status");
	}

	if (startToken) {
		const result = await db
			.prepare(
				`UPDATE studio_sessions
				    SET status = CASE WHEN status = 'live' THEN 'scheduled' ELSE status END,
				        stream_status = 'ended',
				        stream_heartbeat_at = NULL,
				        stream_start_token = CASE
				          WHEN stream_status IN ('starting', 'live')
				            AND stream_start_token = ? THEN NULL
				          WHEN stream_start_token IS NULL
				            AND stream_status NOT IN ('starting', 'live') THEN ?
				          ELSE stream_start_token
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
		return d1WriteChanged(result);
	}

	const result = await db
		.prepare(
			`UPDATE studio_sessions
			    SET status = CASE WHEN status = 'live' THEN 'scheduled' ELSE status END,
			        stream_status = 'ended',
			        stream_start_token = NULL,
			        stream_heartbeat_at = NULL,
			        stream_ended_at = COALESCE(stream_ended_at, unixepoch()),
			        updated_at = unixepoch()
			  WHERE id = ?`,
		)
		.bind(sessionId)
		.run();
	return d1WriteChanged(result);
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
		realtimeKitParticipantId?: string | null;
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
				realtimekit_participant_id,
				joined_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
			ON CONFLICT(session_id, user_id, role) DO UPDATE SET
				github_handle = excluded.github_handle,
				name = excluded.name,
				image_url = excluded.image_url,
				realtimekit_participant_id = COALESCE(
					excluded.realtimekit_participant_id,
					studio_participants.realtimekit_participant_id
				),
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
			input.realtimeKitParticipantId ?? null,
		)
		.run();
}

export async function getStudioParticipantProviderIdentity(
	env: StudioEnv,
	input: {
		sessionId: string;
		user: StudioUser;
		role: StudioRole;
	},
): Promise<StudioParticipantProviderIdentity | null> {
	const db = getDb(env);
	if (!db) return null;

	const row = await db
		.prepare(
			`SELECT realtimekit_participant_id
			   FROM studio_participants
			  WHERE session_id = ?
			    AND user_id = ?
			    AND role = ?
			  LIMIT 1`,
		)
		.bind(input.sessionId, getStudioUserId(input.user), input.role)
		.first<{ realtimekit_participant_id: string | null }>();

	return row
		? { realtimeKitParticipantId: row.realtimekit_participant_id }
		: null;
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
	if (token === "demo") {
		if (!developmentFallbacksEnabled(env)) return null;
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
	if (!db) return null;

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
		if (developmentFallbacksEnabled(env) && isMissingStudioInviteTableError(error)) {
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
	if (invite.tokenHash === "demo") return developmentFallbacksEnabled(env);
	if (!db) return false;

	const userId = getStudioUserId(user);
	const insert = await db
		.prepare(
			`INSERT INTO studio_invite_redemptions (
				token_hash,
				user_id,
				github_handle,
				redeemed_at
			)
			SELECT ?, ?, ?, unixepoch()
			 WHERE EXISTS (
			   SELECT 1
			     FROM studio_invites AS invite
			    WHERE invite.token_hash = ?
			      AND invite.revoked_at IS NULL
			      AND invite.expires_at > unixepoch()
			      AND (
			        invite.max_uses = 0
			        OR (
			          SELECT COUNT(*)
			            FROM studio_invite_redemptions AS redemption
			           WHERE redemption.token_hash = invite.token_hash
			        ) < invite.max_uses
			      )
			 )
			ON CONFLICT(token_hash, user_id) DO NOTHING`,
		)
		.bind(
			invite.tokenHash,
			userId,
			getStudioUserGithubHandle(user),
			invite.tokenHash,
		)
		.run();
	const insertMeta = insert.meta as {
		changes?: number;
		rows_written?: number;
	};
	await db
		.prepare(
			`UPDATE studio_invites
			    SET used_count = (
			      SELECT COUNT(*)
			        FROM studio_invite_redemptions
			       WHERE token_hash = ?
			    )
			  WHERE token_hash = ?`,
		)
		.bind(invite.tokenHash, invite.tokenHash)
		.run();
	if ((insertMeta.changes ?? insertMeta.rows_written ?? 0) > 0) {
		return true;
	}

	const existing = await db
		.prepare(
			`SELECT user_id
			   FROM studio_invite_redemptions
			  WHERE token_hash = ?
			    AND user_id = ?
			  LIMIT 1`,
		)
		.bind(invite.tokenHash, userId)
		.first<{ user_id: string }>();
	return Boolean(existing);
}

function recordingMarkerMatchesRow(
	row: StudioRecordingRow,
	marker: StudioRecordingReadyMarker,
	readyMarkerKey: string,
): boolean {
	return row.recording_id === marker.recordingId &&
		row.session_id === marker.studioSessionId &&
		row.video_id === marker.videoId &&
		row.source_bucket === marker.sourceBucket &&
		row.source_key === marker.sourceKey &&
		row.source_etag === marker.sourceEtag &&
		row.source_format === marker.sourceFormat &&
		row.output_prefix === marker.outputPrefix &&
		row.ready_marker_key === readyMarkerKey;
}

async function getRecordingClaimRow(
	db: D1Database,
	marker: StudioRecordingReadyMarker,
): Promise<StudioRecordingRow | null> {
	const columns = `recording_id,
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
			        updated_at`;
	const videoClaim = await db
		.prepare(
			`SELECT ${columns}
			   FROM studio_recordings
			  WHERE video_id = ?
			  LIMIT 1`,
		)
		.bind(marker.videoId)
		.first<StudioRecordingRow>();
	if (videoClaim) return videoClaim;

	return await db
		.prepare(
			`SELECT ${columns}
			   FROM studio_recordings
			  WHERE recording_id = ?
			  LIMIT 1`,
		)
		.bind(marker.recordingId)
		.first<StudioRecordingRow>();
}

export async function saveRecordingReadyMarker(
	env: StudioEnv,
	marker: StudioRecordingReadyMarker,
): Promise<{ readyMarkerKey: string; sourceVerified: boolean }> {
	const readyMarkerKey = createReadyMarkerKey(
		marker.studioSessionId,
		marker.recordingId,
	);
	await assertCanonicalVodOutputAvailableForMarker(env, marker);
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
					created_at,
					updated_at
				)
				SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'marker-pending', unixepoch(), unixepoch()
				 WHERE NOT EXISTS (
				   SELECT 1
				     FROM studio_recordings
				    WHERE video_id = ?
				 )
				ON CONFLICT DO NOTHING`,
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
				marker.videoId,
			)
			.run();

		const claimed = await getRecordingClaimRow(db, marker);
		if (!claimed || !recordingMarkerMatchesRow(claimed, marker, readyMarkerKey)) {
			throw new StudioRecordingOutputClaimedError();
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
				  WHERE recording_id = ?
				    AND session_id = ?
				    AND video_id = ?
				    AND source_bucket = ?
				    AND source_key = ?
				    AND source_etag = ?
				    AND source_format = ?
				    AND output_prefix = ?
				    AND ready_marker_key = ?`,
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

		await db
			.prepare(
				`UPDATE studio_sessions
				    SET recording_status = 'uploaded',
				        updated_at = unixepoch()
				  WHERE id = ?
				    AND recording_lease_id IS NULL
				    AND (
				      recording_status <> 'recording'
				      OR recording_lease_grace_until IS NULL
				      OR recording_lease_grace_until <= unixepoch()
				    )`,
			)
			.bind(marker.studioSessionId)
			.run();
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
