import type { StudioEnv, StudioUser } from "../env";
import type { RealtimeKitMeeting } from "./realtimekit";

export type StudioRole = "guest" | "host" | "producer" | "program";
export type RecordingStatus =
	| "failed"
	| "idle"
	| "recording"
	| "uploaded"
	| "transcoding"
	| "vod-ready";
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
}

export interface StudioSessionRecord extends StudioSessionSummary {
	showId: string;
	createdById: string;
	createdByGithub: string | null;
	createdAt: number;
	updatedAt: number;
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
	created_by_id: string;
	created_by_github: string | null;
	created_at: number;
	updated_at: number;
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
		createdById: row.created_by_id,
		createdByGithub: row.created_by_github,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function getDb(env: StudioEnv | undefined): D1Database | null {
	return env?.STUDIO_DB ?? null;
}

function isMissingStudioInviteTableError(error: unknown): boolean {
	return error instanceof Error &&
		error.message.includes("no such table: studio_invites");
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

	const { results } = await db
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
			        created_by_id,
			        created_by_github,
			        created_at,
			        updated_at
			   FROM studio_sessions
			  ORDER BY starts_at ASC, created_at ASC
			  LIMIT 50`,
		)
		.all<StudioSessionRow>();

	return await withDerivedSessionRecordingStatuses(
		env,
		(results ?? []).map(rowToSession),
	);
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

	const { results } = await db
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
		.all<StudioSessionRow>();

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

	const row = await db
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
			        created_by_id,
			        created_by_github,
			        created_at,
			        updated_at
			   FROM studio_sessions
			  WHERE id = ?`,
		)
		.bind(sessionId)
		.first<StudioSessionRow>();

	if (!row) return null;
	const [session] = await withDerivedSessionRecordingStatuses(env, [rowToSession(row)]);
	return session ?? null;
}

export async function listStudioRecordings(
	env: StudioEnv | undefined,
	sessionId: string,
): Promise<StudioRecordingSummary[]> {
	const db = getDb(env);
	if (!db) return [];

	const { results } = await db
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
		.all<StudioRecordingRow>();

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
	session: StudioSessionRecord,
	user: StudioUser,
): Promise<boolean> {
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
				created_by_id,
				created_by_github,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				content_video_id = excluded.content_video_id,
				content_video_slug = excluded.content_video_slug,
				title = excluded.title,
				show_id = excluded.show_id,
				show_title = excluded.show_title,
				content_hosts_json = excluded.content_hosts_json,
				content_guests_json = excluded.content_guests_json,
				starts_at = excluded.starts_at,
				status = excluded.status,
				recording_status = excluded.recording_status,
				realtimekit_meeting_id = excluded.realtimekit_meeting_id,
				recording_prefix = excluded.recording_prefix,
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
		status: "scheduled",
		hosts: mergePeople(input.hosts ?? [], [createdByHost]),
		guests: input.guests ?? [],
		recordingStatus: "idle",
		realtimeKitMeetingId: input.meeting?.id ?? null,
		recordingPrefix: `studio/recordings/${sessionId}/`,
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

export async function loadStudioDashboard(
	user: StudioUser | undefined,
	env?: StudioEnv,
): Promise<StudioDashboard> {
	return {
		user: user ?? null,
		sessions: user
			? await listStudioSessionsForUser(env, user)
			: [],
	};
}
