import type { StudioEnv, StudioUser } from "../env";
import {
	getStudioContentEvents,
	getStudioUpcomingContentEvents,
	type StudioContentVideo,
} from "./content";
import {
	cloudflareStreamLiveInputIsActive,
	getCloudflareStreamConfig,
} from "./cloudflare-stream";
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

export interface StudioTranscodeStatus {
	completedAt: string | null;
	status: string;
	statusKey: string;
	streamUrl: string | null;
}

export interface StudioRecordingSummary {
	recordingId: string;
	videoId: string;
	isRehearsal: boolean;
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

export interface StudioInviteClaim {
	claimId: string;
	customParticipantId: string;
	role: StudioRole;
	sessionId: string;
	tokenHash: string;
	userId: string;
}

export interface StudioParticipantProvisioning {
	customParticipantId: string | null;
	githubHandle: string | null;
	participantId: string | null;
	state: "pending" | "ready" | "unknown";
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
	return `recording-${new Date().toISOString().replace(/[:.]/g, "-")}`;
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
	session: Pick<StudioSessionRecord, "contentVideoSlug" | "streamEnvironment">,
): string | null {
	return session.streamEnvironment === "prod" && session.contentVideoSlug
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
	return {
		recordingId: row.recording_id,
		videoId: row.video_id,
		isRehearsal: row.video_id.startsWith("studio-rehearsal-"),
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
	const allowed = (env.STUDIO_OPERATOR_GITHUB_HANDLES ?? "")
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
				        created_by_id,
				        created_by_github,
				        created_at,
				        updated_at
				   FROM studio_sessions
				  ORDER BY starts_at ASC, created_at ASC
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
	if (!env || !userIsConfiguredStudioOperator(env, user)) return [];
	const db = getDb(env);
	if (!db) {
		return [fallbackSession()];
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
		return offlineStudioLiveState();
	}

	let row: StudioSessionRow | null = null;
	try {
		row = await getPublicStudioLiveRow(db, videoSlug.trim());
	} catch (error) {
		if (isMissingStudioSessionsTableError(error)) {
			return offlineStudioLiveState();
		}
		throw error;
	}

	if (!row?.cloudflare_stream_playback_url) {
		return offlineStudioLiveState();
	}

	if (!row.cloudflare_stream_live_input_id || !row.stream_start_token) {
		return offlineStudioLiveState();
	}

	try {
		const config = env ? await getCloudflareStreamConfig(env) : null;
		if (!config) return publicStudioLiveStateFromRow(row);
		if (await cloudflareStreamLiveInputIsActive(
			config,
			row.cloudflare_stream_live_input_id,
		)) {
			return publicStudioLiveStateFromRow(row);
		}
	} catch (error) {
		console.error("Could not reconcile public Studio stream state", error);
		return publicStudioLiveStateFromRow(row);
	}

	const ended = await saveStudioStreamEndedForLease(env as StudioEnv, {
		liveInputId: row.cloudflare_stream_live_input_id,
		sessionId: row.id,
		startToken: row.stream_start_token,
	});
	if (ended) return offlineStudioLiveState();

	// A new publisher may have replaced the lease while the provider check was in flight.
	// Return that newer D1 state without applying the stale provider result to it.
	const latest = await getPublicStudioLiveRow(db, videoSlug.trim());
	return latest?.cloudflare_stream_playback_url &&
		latest.cloudflare_stream_live_input_id &&
		latest.stream_start_token
		? publicStudioLiveStateFromRow(latest)
		: offlineStudioLiveState();
}

function offlineStudioLiveState(): StudioPublicLiveState {
	return { live: false, playbackUrl: null, session: null };
}

function publicStudioLiveStateFromRow(
	row: StudioSessionRow,
): StudioPublicLiveState {
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

async function getPublicStudioLiveRow(
	db: D1Database,
	videoSlug: string,
): Promise<StudioSessionRow | null> {
	return await db
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
			        stream_start_token,
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
		.bind(videoSlug)
		.first<StudioSessionRow>();
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
			status: deriveRecordingStatus(recording.handoffStatus, transcode),
			transcode,
		};
	}));
}

export async function userCanManageStudioSession(
	env: StudioEnv | undefined,
	_session: StudioSessionRecord,
	user: StudioUser,
): Promise<boolean> {
	return Boolean(env && userIsConfiguredStudioOperator(env, user));
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
			    AND status <> 'complete'
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
			    AND (stream_start_token IS NULL OR stream_start_token <> ?)`,
		)
		.bind(startToken, sessionId, startToken)
		.run();
	return d1WriteChanged(result);
}

export async function saveStudioStreamLive(
	env: StudioEnv,
	input: {
		liveInputId: string;
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
			    AND status <> 'complete'
			    AND stream_status = 'starting'
			    AND stream_start_token = ?
			    AND cloudflare_stream_live_input_id = ?`,
		)
		.bind(
			input.publicLive ? 1 : 0,
			input.playbackUrl,
			input.sessionId,
			input.startToken,
			input.liveInputId,
		)
		.run();
	return d1WriteChanged(result);
}

export async function studioStreamPublisherLeaseMatches(
	env: StudioEnv,
	input: {
		liveInputId: string;
		sessionId: string;
		startToken: string;
	},
): Promise<boolean> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to verify Studio stream ownership");
	}

	const row = await db
		.prepare(
			`SELECT id
			   FROM studio_sessions
			  WHERE id = ?
			    AND stream_status = 'live'
			    AND stream_start_token = ?
			    AND cloudflare_stream_live_input_id = ?
			  LIMIT 1`,
		)
		.bind(input.sessionId, input.startToken, input.liveInputId)
		.first<{ id: string }>();
	return row?.id === input.sessionId;
}

export async function getStudioStreamPublisherLease(
	env: StudioEnv,
	sessionId: string,
): Promise<{
	liveInputId: string;
	startToken: string;
} | null> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to load Studio stream ownership");
	}

	const row = await db
		.prepare(
			`SELECT cloudflare_stream_live_input_id,
			        stream_start_token
			   FROM studio_sessions
			  WHERE id = ?
			    AND stream_status IN ('starting', 'live')
			    AND cloudflare_stream_live_input_id IS NOT NULL
			    AND stream_start_token IS NOT NULL
			  LIMIT 1`,
		)
		.bind(sessionId)
		.first<{
			cloudflare_stream_live_input_id: string;
			stream_start_token: string;
		}>();
	return row
		? {
				liveInputId: row.cloudflare_stream_live_input_id,
				startToken: row.stream_start_token,
			}
		: null;
}

export async function claimStudioStreamNotification(
	env: StudioEnv,
	input: {
		liveInputId: string;
		notificationQueuedAt: number;
		sessionId: string;
		startToken: string;
	},
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
			    AND stream_notification_queued_at IS NULL
			    AND stream_start_token = ?
			    AND cloudflare_stream_live_input_id = ?`,
		)
		.bind(
			input.notificationQueuedAt,
			input.sessionId,
			input.startToken,
			input.liveInputId,
		)
		.run();
	return d1WriteChanged(result);
}

export async function releaseStudioStreamNotificationClaim(
	env: StudioEnv,
	input: {
		liveInputId: string;
		notificationQueuedAt: number;
		sessionId: string;
		startToken: string;
	},
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
			    AND stream_notification_queued_at = ?
			    AND stream_start_token = ?
			    AND cloudflare_stream_live_input_id = ?`,
		)
		.bind(
			input.sessionId,
			input.notificationQueuedAt,
			input.startToken,
			input.liveInputId,
		)
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
		return d1WriteChanged(result);
	}

	const result = await db
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
	return d1WriteChanged(result);
}

export async function saveStudioStreamEndedForLease(
	env: StudioEnv,
	input: {
		liveInputId: string;
		sessionId: string;
		startToken: string;
	},
): Promise<boolean> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to reconcile Studio stream status");
	}

	const result = await db
		.prepare(
			`UPDATE studio_sessions
			    SET status = CASE WHEN status = 'live' THEN 'scheduled' ELSE status END,
			        stream_status = 'ended',
			        stream_start_token = NULL,
			        stream_ended_at = COALESCE(stream_ended_at, unixepoch()),
			        updated_at = unixepoch()
			  WHERE id = ?
			    AND stream_status IN ('starting', 'live')
			    AND stream_start_token = ?
			    AND cloudflare_stream_live_input_id = ?`,
		)
		.bind(input.sessionId, input.startToken, input.liveInputId)
		.run();
	return d1WriteChanged(result);
}

export async function saveStudioStreamFailed(
	env: StudioEnv,
	sessionId: string,
	startToken?: string,
): Promise<boolean> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to reset Studio stream status");
	}

	const tokenPredicate = startToken ? "AND stream_start_token = ?" : "";
	const result = await db
		.prepare(
			`UPDATE studio_sessions
			    SET status = CASE WHEN status = 'live' THEN 'scheduled' ELSE status END,
			        stream_status = 'failed',
			        stream_start_token = NULL,
			        stream_ended_at = unixepoch(),
			        updated_at = unixepoch()
			  WHERE id = ?
			    AND stream_status IN ('starting', 'live')
			    ${tokenPredicate}`,
		)
		.bind(...(startToken ? [sessionId, startToken] : [sessionId]))
		.run();
	return d1WriteChanged(result);
}

export async function reclaimStaleStudioStream(
	env: StudioEnv,
	input: {
		sessionId: string;
		staleBefore: number;
		streamStatus: "live" | "starting";
	},
): Promise<boolean> {
	const db = getDb(env);
	if (!db) {
		throw new Error("STUDIO_DB binding is required to reclaim Studio stream status");
	}

	const result = await db
		.prepare(
			`UPDATE studio_sessions
			    SET status = CASE WHEN status = 'live' THEN 'scheduled' ELSE status END,
			        stream_status = 'failed',
			        stream_start_token = NULL,
			        stream_ended_at = unixepoch(),
			        updated_at = unixepoch()
			  WHERE id = ?
			    AND stream_status = ?
			    AND updated_at <= ?`,
		)
		.bind(input.sessionId, input.streamStatus, input.staleBefore)
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
		realtimeKit?: {
			customParticipantId: string;
			participantId: string;
		};
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
				joined_at,
				realtimekit_custom_participant_id,
				realtimekit_participant_id,
				provisioning_state
			)
			VALUES (?, ?, ?, ?, ?, ?, unixepoch(), ?, ?, ?)
			ON CONFLICT(session_id, user_id, role) DO UPDATE SET
				github_handle = excluded.github_handle,
				name = excluded.name,
				image_url = excluded.image_url,
				joined_at = excluded.joined_at,
				realtimekit_custom_participant_id = COALESCE(
					excluded.realtimekit_custom_participant_id,
					studio_participants.realtimekit_custom_participant_id
				),
				realtimekit_participant_id = CASE
					WHEN excluded.realtimekit_custom_participant_id IS NOT NULL
					THEN excluded.realtimekit_participant_id
					ELSE studio_participants.realtimekit_participant_id
				END,
				provisioning_state = CASE
					WHEN excluded.realtimekit_custom_participant_id IS NOT NULL
					THEN excluded.provisioning_state
					ELSE studio_participants.provisioning_state
				END`,
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
			input.realtimeKit?.customParticipantId ?? null,
			input.realtimeKit?.participantId ?? null,
			input.realtimeKit ? "ready" : "unknown",
		)
		.run();
}

export async function getStudioParticipantProvisioning(
	env: StudioEnv,
	input: {
		customParticipantId: string;
		role: StudioRole;
		sessionId: string;
		user: StudioUser;
	},
): Promise<StudioParticipantProvisioning | null> {
	const db = getDb(env);
	if (!db) return null;
	return await db
		.prepare(
			`SELECT github_handle,
			        realtimekit_custom_participant_id,
			        realtimekit_participant_id,
			        provisioning_state
			   FROM studio_participants
			  WHERE session_id = ?
			    AND role = ?
			    AND (
			      user_id = ?
			      OR github_handle = ?
			      OR realtimekit_custom_participant_id = ?
			    )
			  ORDER BY CASE WHEN user_id = ? THEN 0 ELSE 1 END
			  LIMIT 1`,
		)
		.bind(
			input.sessionId,
			input.role,
			getStudioUserId(input.user),
			getStudioUserGithubHandle(input.user),
			input.customParticipantId,
			getStudioUserId(input.user),
		)
		.first<{
			github_handle: string | null;
			provisioning_state: StudioParticipantProvisioning["state"];
			realtimekit_custom_participant_id: string | null;
			realtimekit_participant_id: string | null;
		}>()
		.then((row) => row
			? {
					customParticipantId: row.realtimekit_custom_participant_id,
					githubHandle: row.github_handle,
					participantId: row.realtimekit_participant_id,
					state: row.provisioning_state,
				}
			: null);
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
	const demoInviteEnabled = Boolean(
		import.meta.env.DEV && env?.STUDIO_ENABLE_DEMO_INVITE === "true",
	);
	if (!db || (token === "demo" && demoInviteEnabled)) {
		if (token !== "demo" || !demoInviteEnabled) return null;
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
			session: redactStudioSessionProviderUrls(session),
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
		session: redactStudioSessionProviderUrls(session),
	};
}

function redactStudioSessionProviderUrls(
	session: StudioSessionRecord,
): StudioSessionRecord {
	return {
		...session,
		cloudflareStreamLiveInputId: null,
		cloudflareStreamPlaybackUrl: null,
	};
}

export async function reserveStudioInviteParticipant(
	env: StudioEnv,
	invite: StudioInvite,
	user: StudioUser,
	input: {
		customParticipantId: string;
		imageUrl: string | null;
		name: string;
	},
): Promise<StudioInviteClaim | null> {
	const userId = getStudioUserId(user);
	const claimId = await hashInviteToken(`${invite.tokenHash}:${userId}`);
	const claim = {
		claimId,
		customParticipantId: input.customParticipantId,
		role: invite.role,
		sessionId: invite.sessionId,
		tokenHash: invite.tokenHash,
		userId,
	} satisfies StudioInviteClaim;
	const db = getDb(env);
	if (!db || invite.tokenHash === "demo") return claim;

	const [claimResult, participantResult] = await db.batch([
		db.prepare(
			`INSERT INTO studio_invite_redemptions (
				token_hash,
				user_id,
				github_handle,
				redeemed_at,
				state,
				claim_id,
				finalized_at
			)
			SELECT studio_invites.token_hash,
			       ?,
			       ?,
			       unixepoch(),
			       'pending',
			       ?,
			       NULL
			  FROM studio_invites
			 WHERE studio_invites.token_hash = ?
			   AND studio_invites.session_id = ?
			   AND studio_invites.role = ?
			   AND studio_invites.revoked_at IS NULL
			   AND studio_invites.expires_at > unixepoch()
			   AND (
			     studio_invites.max_uses = 0
			     OR EXISTS (
			       SELECT 1
			         FROM studio_invite_redemptions AS existing_claim
			        WHERE existing_claim.token_hash = studio_invites.token_hash
			          AND existing_claim.user_id = ?
			          AND existing_claim.state IN ('pending', 'redeemed')
			     )
			     OR (
			       SELECT COUNT(*)
			         FROM studio_invite_redemptions AS active_claim
			        WHERE active_claim.token_hash = studio_invites.token_hash
			          AND active_claim.state IN ('pending', 'redeemed')
			     ) < studio_invites.max_uses
			   )
			ON CONFLICT(token_hash, user_id) DO UPDATE SET
				github_handle = excluded.github_handle,
				claim_id = excluded.claim_id
			WHERE studio_invite_redemptions.state IN ('pending', 'redeemed')`,
		).bind(
			userId,
			getStudioUserGithubHandle(user),
			claimId,
			invite.tokenHash,
			invite.sessionId,
			invite.role,
			userId,
		),
		db.prepare(
			`INSERT INTO studio_participants (
				session_id,
				user_id,
				github_handle,
				role,
				name,
				image_url,
				joined_at,
				realtimekit_custom_participant_id,
				realtimekit_participant_id,
				provisioning_state,
				invite_token_hash,
				invite_claim_id
			)
			SELECT ?, ?, ?, ?, ?, ?, unixepoch(), ?, NULL, 'pending', ?, ?
			 WHERE EXISTS (
			   SELECT 1
			     FROM studio_invite_redemptions
			    WHERE token_hash = ?
			      AND user_id = ?
			      AND claim_id = ?
			      AND state IN ('pending', 'redeemed')
			 )
			ON CONFLICT(session_id, user_id, role) DO UPDATE SET
				github_handle = excluded.github_handle,
				name = excluded.name,
				image_url = excluded.image_url,
				joined_at = excluded.joined_at,
				realtimekit_custom_participant_id = excluded.realtimekit_custom_participant_id,
				realtimekit_participant_id = CASE
					WHEN studio_participants.realtimekit_custom_participant_id = excluded.realtimekit_custom_participant_id
					THEN studio_participants.realtimekit_participant_id
					ELSE NULL
				END,
				provisioning_state = CASE
					WHEN studio_participants.realtimekit_custom_participant_id = excluded.realtimekit_custom_participant_id
					 AND studio_participants.realtimekit_participant_id IS NOT NULL
					 AND studio_participants.provisioning_state = 'ready'
					THEN 'ready'
					ELSE 'pending'
				END,
				invite_token_hash = excluded.invite_token_hash,
				invite_claim_id = excluded.invite_claim_id`,
		).bind(
			invite.sessionId,
			userId,
			getStudioUserGithubHandle(user),
			invite.role,
			input.name,
			input.imageUrl,
			input.customParticipantId,
			invite.tokenHash,
			claimId,
			invite.tokenHash,
			userId,
			claimId,
		),
	]);

	return claimResult &&
		participantResult &&
		d1WriteChanged(claimResult) &&
		d1WriteChanged(participantResult)
		? claim
		: null;
}

export async function finalizeStudioInviteParticipant(
	env: StudioEnv,
	claim: StudioInviteClaim,
	provider: {
		customParticipantId: string;
		participantId: string;
	},
): Promise<boolean> {
	const db = getDb(env);
	if (!db || claim.tokenHash === "demo") return true;

	const [participantResult, redemptionResult] = await db.batch([
		db.prepare(
			`UPDATE studio_participants
			    SET realtimekit_custom_participant_id = ?,
			        realtimekit_participant_id = ?,
			        provisioning_state = 'ready',
			        joined_at = unixepoch()
			  WHERE session_id = ?
			    AND user_id = ?
			    AND role = ?
			    AND invite_token_hash = ?
			    AND invite_claim_id = ?
			    AND realtimekit_custom_participant_id IN (?, ?)
			    AND (realtimekit_participant_id IS NULL OR realtimekit_participant_id = ?)`,
		).bind(
			provider.customParticipantId,
			provider.participantId,
			claim.sessionId,
			claim.userId,
			claim.role,
			claim.tokenHash,
			claim.claimId,
			claim.customParticipantId,
			provider.customParticipantId,
			provider.participantId,
		),
		db.prepare(
			`UPDATE studio_invite_redemptions
			    SET state = 'redeemed',
			        finalized_at = COALESCE(finalized_at, unixepoch())
			  WHERE token_hash = ?
			    AND user_id = ?
			    AND claim_id = ?
			    AND state IN ('pending', 'redeemed')
			    AND EXISTS (
			      SELECT 1
			        FROM studio_participants
			       WHERE session_id = ?
			         AND user_id = ?
			         AND role = ?
			         AND realtimekit_custom_participant_id = ?
			         AND realtimekit_participant_id = ?
			         AND provisioning_state = 'ready'
			         AND invite_token_hash = ?
			         AND invite_claim_id = ?
			    )`,
		).bind(
			claim.tokenHash,
			claim.userId,
			claim.claimId,
			claim.sessionId,
			claim.userId,
			claim.role,
			provider.customParticipantId,
			provider.participantId,
			claim.tokenHash,
			claim.claimId,
		),
		db.prepare(
			`UPDATE studio_invites
			    SET used_count = (
			      SELECT COUNT(*)
			        FROM studio_invite_redemptions
			       WHERE studio_invite_redemptions.token_hash = studio_invites.token_hash
			         AND studio_invite_redemptions.state = 'redeemed'
			    )
			  WHERE token_hash = ?`,
		).bind(claim.tokenHash),
	]);

	return Boolean(
		participantResult &&
		redemptionResult &&
		d1WriteChanged(participantResult) &&
		d1WriteChanged(redemptionResult),
	);
}

export async function releaseStudioInviteParticipantClaim(
	env: StudioEnv,
	claim: StudioInviteClaim,
): Promise<boolean> {
	const db = getDb(env);
	if (!db || claim.tokenHash === "demo") return true;

	const [, redemptionResult] = await db.batch([
		db.prepare(
			`DELETE FROM studio_participants
			  WHERE session_id = ?
			    AND user_id = ?
			    AND role = ?
			    AND realtimekit_custom_participant_id = ?
			    AND realtimekit_participant_id IS NULL
			    AND provisioning_state = 'pending'
			    AND invite_token_hash = ?
			    AND invite_claim_id = ?`,
		).bind(
			claim.sessionId,
			claim.userId,
			claim.role,
			claim.customParticipantId,
			claim.tokenHash,
			claim.claimId,
		),
		db.prepare(
			`DELETE FROM studio_invite_redemptions
			  WHERE token_hash = ?
			    AND user_id = ?
			    AND claim_id = ?
			    AND state = 'pending'
			    AND NOT EXISTS (
			      SELECT 1
			        FROM studio_participants
			       WHERE session_id = ?
			         AND user_id = ?
			         AND role = ?
			         AND realtimekit_custom_participant_id = ?
			         AND (realtimekit_participant_id IS NOT NULL OR provisioning_state = 'ready')
			    )`,
		).bind(
			claim.tokenHash,
			claim.userId,
			claim.claimId,
			claim.sessionId,
			claim.userId,
			claim.role,
			claim.customParticipantId,
		),
		db.prepare(
			`UPDATE studio_invites
			    SET used_count = (
			      SELECT COUNT(*)
			        FROM studio_invite_redemptions
			       WHERE studio_invite_redemptions.token_hash = studio_invites.token_hash
			         AND studio_invite_redemptions.state = 'redeemed'
			    )
			  WHERE token_hash = ?`,
		).bind(claim.tokenHash),
	]);

	return Boolean(redemptionResult && d1WriteChanged(redemptionResult));
}

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
					updated_at = excluded.updated_at`,
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

type StudioStreamLeaseRow = {
	cloudflare_stream_live_input_id: string | null;
	stream_start_token: string | null;
};

async function reconcileStudioSessionLiveState(
	env: StudioEnv | undefined,
	session: StudioSessionRecord,
): Promise<StudioSessionRecord> {
	if (!env || session.streamStatus !== "live") return session;
	const db = getDb(env);
	if (!db) return session;

	const lease = await db
		.prepare(
			`SELECT cloudflare_stream_live_input_id,
			        stream_start_token
			   FROM studio_sessions
			  WHERE id = ?
			    AND stream_status = 'live'
			  LIMIT 1`,
		)
		.bind(session.id)
		.first<StudioStreamLeaseRow>();
	if (!lease?.cloudflare_stream_live_input_id || !lease.stream_start_token) {
		return session;
	}

	try {
		const config = await getCloudflareStreamConfig(env);
		if (!config) return session;
		if (await cloudflareStreamLiveInputIsActive(
			config,
			lease.cloudflare_stream_live_input_id,
		)) {
			return session;
		}
	} catch (error) {
		console.error("Could not reconcile Studio control state", error);
		return session;
	}

	await saveStudioStreamEndedForLease(env, {
		liveInputId: lease.cloudflare_stream_live_input_id,
		sessionId: session.id,
		startToken: lease.stream_start_token,
	});
	return await getStudioSession(env, session.id) ?? session;
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
	if (!isOperator) {
		return {
			contentError: null,
			events: [],
			isOperator: false,
			user,
			sessions: [],
		};
	}
	const [{ error: contentError, events: contentEvents }, storedSessions] =
		await Promise.all([
			loadContentEvents(env, { upcomingOnly: isOperator }),
			listStudioSessions(env),
		]);
	const allSessions = await Promise.all(
		storedSessions.map((session) => reconcileStudioSessionLiveState(env, session)),
	);
	const sessionsByContentVideoId = groupSessionsByContentVideoId(allSessions);
	const visibleEvents = contentEvents.filter((event) => isUpcomingEvent(event));
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
		sessions: allSessions,
	};
}
