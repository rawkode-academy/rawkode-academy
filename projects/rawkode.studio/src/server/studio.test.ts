import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioEnv } from "../env";
import {
	clearCloudflareStreamLiveInputCache,
	createCloudflareStreamLiveInput,
} from "./cloudflare-stream";
import {
	abortStudioRecordingUpload,
	completeStudioRecordingUpload,
	confirmStudioStream,
	createStudioInvite,
	createStudioRecordingUpload,
	createStudioSession,
	endStudioSession,
	issueStudioParticipantToken,
	markStudioRecordingReady,
	resetStudioStream,
	startStudioStream,
	stopStudioStream,
	uploadStudioRecordingPart,
} from "./operations";
import {
	buildStudioSession,
	createReadyMarker,
	createReadyMarkerKey,
	finalizeStudioInviteParticipant,
	getPublicStudioLiveState,
	getStudioSession,
	getStudioSessionWatchUrl,
	hashInviteToken,
	listStudioRecordings,
	loadStudioDashboard,
	releaseStudioInviteParticipantClaim,
	reserveStudioInviteParticipant,
	resolveStudioInvite,
	type StudioInvite,
	type StudioInviteClaim,
	userCanManageStudioSession,
} from "./studio";

const user = {
	id: "rawkode",
	email: "rawkode@users.noreply.github.com",
	image: null,
	name: "Rawkode",
	username: "rawkode",
};
const guestUser = {
	id: "guest",
	email: "guest@users.noreply.github.com",
	image: null,
	name: "Guest",
	username: "guest",
};

function createSecretsStoreRpcBinding(secret: string): {
	binding: SecretsStoreSecret;
	get: ReturnType<typeof vi.fn>;
} {
	const get = vi.fn(async () => secret);
	const rpcGet = new Proxy(get, {
		get(target, property, receiver) {
			if (property === "call") {
				return () => {
					throw new Error('The RPC receiver does not implement the method "call".');
				};
			}
			return Reflect.get(target, property, receiver);
		},
	});
	return {
		binding: { get: rpcGet } as SecretsStoreSecret,
		get,
	};
}

type StudioRecordingDbRow = {
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

type StudioInviteDbRow = {
	token_hash: string;
	session_id: string;
	role: "guest" | "host" | "producer" | "program";
	expires_at: number;
	max_uses: number;
	used_count: number;
	created_by_id: string;
	created_by_github: string | null;
	created_at: number;
	revoked_at: number | null;
};

type StudioInviteRedemptionDbRow = {
	claim_id: string | null;
	finalized_at: number | null;
	github_handle: string | null;
	redeemed_at: number;
	state: "pending" | "redeemed";
	token_hash: string;
	user_id: string;
};

type StudioParticipantDbRow = {
	github_handle: string | null;
	image_url: string | null;
	invite_claim_id: string | null;
	invite_token_hash: string | null;
	joined_at: number;
	name: string;
	provisioning_state: "pending" | "ready" | "unknown";
	realtimekit_custom_participant_id: string | null;
	realtimekit_participant_id: string | null;
	role: "guest" | "host" | "producer" | "program";
	session_id: string;
	user_id: string;
};

type StudioDbMockOptions = Partial<{
	content_guests_json: string;
	content_hosts_json: string;
	content_video_id: string | null;
	content_video_slug: string | null;
	id: string;
	cloudflare_stream_live_input_id: string | null;
	cloudflare_stream_playback_url: string | null;
	realtimekit_meeting_id: string | null;
	recording_prefix: string;
	recording_status: "failed" | "idle" | "recording" | "transcoding" | "uploaded" | "vod-ready";
	show_id: string;
	show_title: string;
	status: "complete" | "live" | "recording" | "scheduled";
	stream_ended_at: number | null;
	stream_environment: "prod" | "test";
	stream_notification_queued_at: number | null;
	stream_start_token: string | null;
	stream_started_at: number | null;
	stream_status: "ended" | "failed" | "idle" | "live" | "starting";
	title: string;
	updated_at: number;
}> & {
	inviteRows?: StudioInviteDbRow[];
	failFinalizeBatches?: number;
	participantRows?: StudioParticipantDbRow[];
	recordingRows?: StudioRecordingDbRow[];
	replaceLeaseBeforeEnd?: { liveInputId: string; startToken: string };
	redemptionRows?: Array<Partial<StudioInviteRedemptionDbRow> & {
		token_hash: string;
		user_id: string;
	}>;
};

function createStudioDbMock(options: StudioDbMockOptions = {}) {
	const {
		failFinalizeBatches = 0,
		inviteRows = [],
		participantRows = [],
		recordingRows = [],
		replaceLeaseBeforeEnd,
		redemptionRows: initialRedemptionRows = [],
		...overrides
	} = options;
	let remainingFinalizeBatchFailures = failFinalizeBatches;
	const redemptionRows: StudioInviteRedemptionDbRow[] = initialRedemptionRows.map(
		(row) => ({
			claim_id: row.claim_id ?? null,
			finalized_at: row.finalized_at ?? row.redeemed_at ?? 1,
			github_handle: row.github_handle ?? row.user_id,
			redeemed_at: row.redeemed_at ?? 1,
			state: row.state ?? "redeemed",
			token_hash: row.token_hash,
			user_id: row.user_id,
		}),
	);
	let leaseReplacementApplied = false;
	let batchQueue = Promise.resolve();
	const writes: Array<{ params: unknown[]; sql: string }> = [];
	const sessionRow = {
		id: "rawkode-live-next",
		content_video_id: null,
		content_video_slug: null,
		title: "Rawkode Live production room",
		show_id: "rawkode-live",
		show_title: "Rawkode Live",
		content_hosts_json: "[]",
		content_guests_json: "[]",
		starts_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
		status: "scheduled",
		recording_status: "idle",
		realtimekit_meeting_id: null,
		recording_prefix: "studio/recordings/rawkode-live-next/",
		stream_environment: "test",
		stream_status: "idle",
		cloudflare_stream_live_input_id: null,
		cloudflare_stream_playback_url: null,
		stream_started_at: null,
		stream_ended_at: null,
		stream_notification_queued_at: null,
		stream_start_token: null,
		created_by_id: "rawkode",
		created_by_github: "rawkode",
		created_at: 1,
		updated_at: Math.floor(Date.now() / 1000),
		...overrides,
	};
	const db = {
		batch: (statements: D1PreparedStatement[]) => {
			const execute = async () => {
				const inviteSnapshot = inviteRows.map((row) => ({ ...row }));
				const participantSnapshot = participantRows.map((row) => ({ ...row }));
				const redemptionSnapshot = redemptionRows.map((row) => ({ ...row }));
				const firstSql = String((statements[0] as unknown as { __sql?: string }).__sql ?? "");
				if (
					remainingFinalizeBatchFailures > 0 &&
					firstSql.includes("UPDATE studio_participants") &&
					firstSql.includes("provisioning_state = 'ready'")
				) {
					remainingFinalizeBatchFailures -= 1;
					throw new Error("injected participant finalization failure");
				}
				try {
					const results: D1Result<unknown>[] = [];
					for (const statement of statements) {
						results.push(await statement.run());
					}
					return results;
				} catch (error) {
					inviteRows.splice(0, inviteRows.length, ...inviteSnapshot);
					participantRows.splice(0, participantRows.length, ...participantSnapshot);
					redemptionRows.splice(0, redemptionRows.length, ...redemptionSnapshot);
					throw error;
				}
			};
			const pending = batchQueue.then(execute, execute);
			batchQueue = pending.then(() => undefined, () => undefined);
			return pending;
		},
		prepare: (sql: string) => {
			const all = async (...params: unknown[]) => ({
				results: sql.includes("FROM studio_recordings")
					? recordingRows.filter((row) => row.session_id === params[0])
					: sql.includes("FROM studio_sessions")
						? [sessionRow]
						: [],
			});
			return {
				all: async () => all(),
				bind: (...params: unknown[]) => ({
					__params: params,
					__sql: sql,
					all: async () => all(...params),
					first: async () => {
						if (
							sql.includes("realtimekit_custom_participant_id") &&
							sql.includes("FROM studio_participants")
						) {
							const [
								sessionId,
								role,
								userId,
								githubHandle,
								customParticipantId,
							] = params.map(String);
							const rows = participantRows.filter((row) =>
								row.session_id === sessionId &&
								row.role === role &&
								(
									row.user_id === userId ||
									row.github_handle === githubHandle ||
									row.realtimekit_custom_participant_id === customParticipantId
								)
							);
							const row = rows.find((candidate) => candidate.user_id === userId) ?? rows[0];
							return row
								? {
									github_handle: row.github_handle,
									provisioning_state: row.provisioning_state,
									realtimekit_custom_participant_id:
										row.realtimekit_custom_participant_id,
									realtimekit_participant_id: row.realtimekit_participant_id,
								}
								: null;
						}
						if (
							sql.includes("SELECT cloudflare_stream_live_input_id") &&
							sql.includes("stream_status IN ('starting', 'live')")
						) {
							return sessionRow.id === String(params[0]) &&
								(sessionRow.stream_status === "starting" ||
									sessionRow.stream_status === "live") &&
								sessionRow.cloudflare_stream_live_input_id &&
								sessionRow.stream_start_token
								? {
									cloudflare_stream_live_input_id:
										sessionRow.cloudflare_stream_live_input_id,
									stream_start_token: sessionRow.stream_start_token,
								}
								: null;
						}
						if (
							sql.includes("SELECT id") &&
							sql.includes("AND stream_start_token = ?") &&
							sql.includes("AND cloudflare_stream_live_input_id = ?")
						) {
							return sessionRow.id === String(params[0]) &&
								sessionRow.stream_status === "live" &&
								sessionRow.stream_start_token === String(params[1]) &&
								sessionRow.cloudflare_stream_live_input_id === String(params[2])
								? { id: sessionRow.id }
								: null;
						}
						if (sql.includes("FROM studio_invites")) {
							const tokenHash = String(params[0] ?? "");
							const userId = String(params[1] ?? "");
							return inviteRows.find((row) =>
								row.token_hash === tokenHash &&
								!row.revoked_at &&
								row.expires_at > Math.floor(Date.now() / 1000) &&
								(
									row.max_uses === 0 ||
									row.used_count < row.max_uses ||
									redemptionRows.some((redemption) =>
										redemption.token_hash === row.token_hash &&
										redemption.user_id === userId
									)
								)
							) ?? null;
						}
						if (sql.includes("FROM studio_invite_redemptions")) {
							const tokenHash = String(params[0] ?? "");
							const userId = String(params[1] ?? "");
							const redemption = redemptionRows.find((row) =>
								row.token_hash === tokenHash && row.user_id === userId
							);
							return redemption ? { user_id: redemption.user_id } : null;
						}
						if (sql.includes("content_video_slug = ?")) {
							const videoSlug = String(params[0] ?? "");
							return sessionRow.content_video_slug === videoSlug &&
								sessionRow.stream_environment === "prod" &&
								sessionRow.stream_status === "live" &&
								sessionRow.status === "live" &&
								sessionRow.cloudflare_stream_playback_url
								? { ...sessionRow }
								: null;
						}
						return sql.includes("FROM studio_sessions")
							? { ...sessionRow }
							: null;
						},
					run: async () => {
						let changes = 1;
						writes.push({ sql, params });
						if (
							sql.includes("INSERT INTO studio_invite_redemptions") &&
							sql.includes("'pending'")
						) {
							const [
								userId,
								githubHandle,
								claimId,
								tokenHash,
								sessionId,
								role,
							] = params.map((param) => String(param ?? ""));
							const invite = inviteRows.find((row) =>
								row.token_hash === tokenHash &&
								row.session_id === sessionId &&
								row.role === role &&
								row.revoked_at === null &&
								row.expires_at > Math.floor(Date.now() / 1000)
							);
							const existing = redemptionRows.find((row) =>
								row.token_hash === tokenHash && row.user_id === userId
							);
							const activeClaimCount = redemptionRows.filter((row) =>
								row.token_hash === tokenHash &&
								(row.state === "pending" || row.state === "redeemed")
							).length;
							const canReserve = Boolean(
								invite &&
								(
									invite.max_uses === 0 ||
									Boolean(existing && (
										existing.state === "pending" || existing.state === "redeemed"
									)) ||
									activeClaimCount < invite.max_uses
								)
							);
							if (!canReserve) {
								changes = 0;
							} else if (existing) {
								existing.github_handle = githubHandle || null;
								existing.claim_id = claimId;
							} else {
								redemptionRows.push({
									claim_id: claimId,
									finalized_at: null,
									github_handle: githubHandle || null,
									redeemed_at: Math.floor(Date.now() / 1000),
									state: "pending",
									token_hash: tokenHash,
									user_id: userId,
								});
							}
							return { meta: { changes, rows_written: changes } };
						}
						if (
							sql.includes("INSERT INTO studio_participants") &&
							sql.includes("'pending'")
						) {
							const [
								sessionId,
								userId,
								githubHandle,
								role,
								name,
								imageUrl,
								customParticipantId,
								inviteTokenHash,
								inviteClaimId,
								tokenHash,
								claimedUserId,
								claimId,
							] = params.map((param) => param === null ? null : String(param));
							const hasClaim = redemptionRows.some((row) =>
								row.token_hash === tokenHash &&
								row.user_id === claimedUserId &&
								row.claim_id === claimId &&
								(row.state === "pending" || row.state === "redeemed")
							);
							if (!hasClaim) {
								changes = 0;
							} else {
								const existing = participantRows.find((row) =>
									row.session_id === sessionId &&
									row.user_id === userId &&
									row.role === role
								);
								const next = {
									github_handle: githubHandle,
									image_url: imageUrl,
									invite_claim_id: inviteClaimId,
									invite_token_hash: inviteTokenHash,
									joined_at: Math.floor(Date.now() / 1000),
									name: name ?? "Studio participant",
									provisioning_state: "pending" as const,
									realtimekit_custom_participant_id: customParticipantId,
									realtimekit_participant_id: null,
									role: role as StudioParticipantDbRow["role"],
									session_id: sessionId ?? "",
									user_id: userId ?? "",
								};
								if (existing) {
									const preserveReady =
										existing.realtimekit_custom_participant_id === customParticipantId &&
										existing.realtimekit_participant_id !== null &&
										existing.provisioning_state === "ready";
									Object.assign(existing, next, preserveReady
										? {
											provisioning_state: "ready",
											realtimekit_participant_id:
												existing.realtimekit_participant_id,
										}
										: {});
								} else {
									participantRows.push(next);
								}
							}
							return { meta: { changes, rows_written: changes } };
						}
						if (
							sql.includes("UPDATE studio_participants") &&
							sql.includes("provisioning_state = 'ready'")
						) {
							const [
								providerCustomId,
								providerParticipantId,
								sessionId,
								userId,
								role,
								tokenHash,
								claimId,
								claimCustomId,
								allowedProviderCustomId,
								allowedProviderParticipantId,
							] = params.map(String);
							const row = participantRows.find((candidate) =>
								candidate.session_id === sessionId &&
								candidate.user_id === userId &&
								candidate.role === role &&
								candidate.invite_token_hash === tokenHash &&
								candidate.invite_claim_id === claimId &&
								(
									candidate.realtimekit_custom_participant_id === claimCustomId ||
									candidate.realtimekit_custom_participant_id === allowedProviderCustomId
								) &&
								(
									candidate.realtimekit_participant_id === null ||
									candidate.realtimekit_participant_id === allowedProviderParticipantId
								)
							);
							if (!row) {
								changes = 0;
							} else {
								row.realtimekit_custom_participant_id = providerCustomId;
								row.realtimekit_participant_id = providerParticipantId;
								row.provisioning_state = "ready";
								row.joined_at = Math.floor(Date.now() / 1000);
							}
							return { meta: { changes, rows_written: changes } };
						}
						if (
							sql.includes("UPDATE studio_invite_redemptions") &&
							sql.includes("SET state = 'redeemed'")
						) {
							const [
								tokenHash,
								userId,
								claimId,
								sessionId,
								participantUserId,
								role,
								customParticipantId,
								participantId,
								participantTokenHash,
								participantClaimId,
							] = params.map(String);
							const redemption = redemptionRows.find((row) =>
								row.token_hash === tokenHash &&
								row.user_id === userId &&
								row.claim_id === claimId &&
								(row.state === "pending" || row.state === "redeemed")
							);
							const participant = participantRows.find((row) =>
								row.session_id === sessionId &&
								row.user_id === participantUserId &&
								row.role === role &&
								row.realtimekit_custom_participant_id === customParticipantId &&
								row.realtimekit_participant_id === participantId &&
								row.provisioning_state === "ready" &&
								row.invite_token_hash === participantTokenHash &&
								row.invite_claim_id === participantClaimId
							);
							if (!redemption || !participant) {
								changes = 0;
							} else {
								redemption.state = "redeemed";
								redemption.finalized_at ??= Math.floor(Date.now() / 1000);
							}
							return { meta: { changes, rows_written: changes } };
						}
						if (
							sql.includes("UPDATE studio_invites") &&
							sql.includes("SELECT COUNT(*)")
						) {
							const tokenHash = String(params[0]);
							const invite = inviteRows.find((row) => row.token_hash === tokenHash);
							if (!invite) {
								changes = 0;
							} else {
								invite.used_count = redemptionRows.filter((row) =>
									row.token_hash === tokenHash && row.state === "redeemed"
								).length;
							}
							return { meta: { changes, rows_written: changes } };
						}
						if (
							sql.includes("DELETE FROM studio_participants") &&
							sql.includes("provisioning_state = 'pending'")
						) {
							const [
								sessionId,
								userId,
								role,
								customParticipantId,
								tokenHash,
								claimId,
							] = params.map(String);
							const index = participantRows.findIndex((row) =>
								row.session_id === sessionId &&
								row.user_id === userId &&
								row.role === role &&
								row.realtimekit_custom_participant_id === customParticipantId &&
								row.realtimekit_participant_id === null &&
								row.provisioning_state === "pending" &&
								row.invite_token_hash === tokenHash &&
								row.invite_claim_id === claimId
							);
							if (index < 0) {
								changes = 0;
							} else {
								participantRows.splice(index, 1);
							}
							return { meta: { changes, rows_written: changes } };
						}
						if (
							sql.includes("DELETE FROM studio_invite_redemptions") &&
							sql.includes("state = 'pending'")
						) {
							const [
								tokenHash,
								userId,
								claimId,
								sessionId,
								participantUserId,
								role,
								customParticipantId,
							] = params.map(String);
							const protectedParticipant = participantRows.some((row) =>
								row.session_id === sessionId &&
								row.user_id === participantUserId &&
								row.role === role &&
								row.realtimekit_custom_participant_id === customParticipantId &&
								(
									row.realtimekit_participant_id !== null ||
									row.provisioning_state === "ready"
								)
							);
							const index = protectedParticipant
								? -1
								: redemptionRows.findIndex((row) =>
									row.token_hash === tokenHash &&
									row.user_id === userId &&
									row.claim_id === claimId &&
									row.state === "pending"
								);
							if (index < 0) {
								changes = 0;
							} else {
								redemptionRows.splice(index, 1);
							}
							return { meta: { changes, rows_written: changes } };
						}
						if (sql.includes("INSERT INTO studio_participants")) {
							const [
								sessionId,
								userId,
								githubHandle,
								role,
								name,
								imageUrl,
								customParticipantId,
								providerParticipantId,
								provisioningState,
							] = params.map((param) => param === null ? null : String(param));
							const row = participantRows.find((candidate) =>
								candidate.session_id === sessionId &&
								candidate.user_id === userId &&
								candidate.role === role
							);
							const base = {
								github_handle: githubHandle,
								image_url: imageUrl,
								joined_at: Math.floor(Date.now() / 1000),
								name: name ?? "Studio participant",
								role: role as StudioParticipantDbRow["role"],
								session_id: sessionId ?? "",
								user_id: userId ?? "",
							};
							if (row) {
								Object.assign(row, base);
								if (customParticipantId !== null) {
									row.realtimekit_custom_participant_id = customParticipantId;
									row.realtimekit_participant_id = providerParticipantId;
									row.provisioning_state =
										provisioningState as StudioParticipantDbRow["provisioning_state"];
								}
							} else {
								participantRows.push({
									...base,
									invite_claim_id: null,
									invite_token_hash: null,
									provisioning_state: (provisioningState ?? "unknown") as
										StudioParticipantDbRow["provisioning_state"],
									realtimekit_custom_participant_id: customParticipantId,
									realtimekit_participant_id: providerParticipantId,
								});
							}
							return { meta: { changes, rows_written: changes } };
						}
						if (sql.includes("INSERT INTO studio_recordings")) {
							const now = Math.floor(Date.now() / 1000);
							const recordingId = String(params[0]);
							const nextRow: StudioRecordingDbRow = {
								recording_id: recordingId,
								session_id: String(params[1]),
								video_id: String(params[2]),
								source_bucket: String(params[3]),
								source_key: String(params[4]),
								source_etag: String(params[5]),
								source_format: params[6] as StudioRecordingDbRow["source_format"],
								output_prefix: String(params[7]),
								ready_marker_key: String(params[8]),
								status: "marker-pending",
								created_at: now,
								updated_at: now,
							};
							const existingIndex = recordingRows.findIndex((row) =>
								row.recording_id === recordingId
							);
							if (existingIndex >= 0) {
								recordingRows[existingIndex] = {
									...recordingRows[existingIndex],
									...nextRow,
									created_at: recordingRows[existingIndex].created_at,
								};
							} else {
								recordingRows.unshift(nextRow);
							}
						}
						if (sql.includes("UPDATE studio_recordings")) {
							const recordingId = String(params[0]);
							const row = recordingRows.find((candidate) =>
								candidate.recording_id === recordingId
							);
							if (row) {
								row.status = "ready";
								row.updated_at = Math.floor(Date.now() / 1000);
							}
						}
						if (sql.includes("UPDATE studio_sessions")) {
							const now = Math.floor(Date.now() / 1000);
							if (sql.includes("recording_status = ?")) {
								sessionRow.recording_status =
									params[0] as NonNullable<StudioDbMockOptions["recording_status"]>;
							}
							if (sql.includes("SET status = ?")) {
								sessionRow.status =
									params[0] as NonNullable<StudioDbMockOptions["status"]>;
							}
							if (
								sql.includes("SET stream_status = 'starting'") &&
								sql.includes("cloudflare_stream_live_input_id")
							) {
								if (
									sessionRow.status !== "complete" &&
									sessionRow.stream_status === "starting" &&
									sessionRow.stream_start_token === String(params[3])
								) {
									sessionRow.stream_status = "starting";
									sessionRow.cloudflare_stream_live_input_id = String(params[0]);
									sessionRow.cloudflare_stream_playback_url = String(params[1]);
									sessionRow.stream_started_at = null;
									sessionRow.stream_ended_at = null;
								} else {
									changes = 0;
								}
							} else if (sql.includes("SET stream_status = 'starting'")) {
								if (
									sessionRow.status !== "complete" &&
									sessionRow.stream_status !== "starting" &&
									sessionRow.stream_status !== "live" &&
									(
										sessionRow.stream_start_token === null ||
										sessionRow.stream_start_token !== String(params[2])
									)
								) {
									sessionRow.stream_status = "starting";
									sessionRow.stream_start_token = String(params[0]);
									sessionRow.stream_started_at = null;
									sessionRow.stream_ended_at = null;
								} else {
									changes = 0;
								}
							}
							if (sql.includes("SET status = CASE WHEN ? = 1")) {
								if (
									sessionRow.status !== "complete" &&
									sessionRow.stream_status === "starting" &&
									sessionRow.stream_start_token === String(params[3]) &&
									sessionRow.cloudflare_stream_live_input_id === String(params[4])
								) {
									sessionRow.status = params[0] === 1 ? "live" : sessionRow.status;
									sessionRow.stream_status = "live";
									sessionRow.cloudflare_stream_playback_url = String(params[1]);
									sessionRow.stream_started_at = now;
									sessionRow.stream_ended_at = null;
								} else {
									changes = 0;
								}
							}
							if (sql.includes("SET stream_notification_queued_at = ?")) {
								if (
									sessionRow.stream_environment === "prod" &&
									sessionRow.stream_status === "live" &&
									sessionRow.status === "live" &&
									sessionRow.stream_notification_queued_at === null &&
									sessionRow.stream_start_token === String(params[2]) &&
									sessionRow.cloudflare_stream_live_input_id === String(params[3])
								) {
									sessionRow.stream_notification_queued_at = Number(params[0]);
								} else {
									changes = 0;
								}
							}
							if (sql.includes("stream_notification_queued_at = NULL")) {
								if (
									sessionRow.stream_notification_queued_at === Number(params[1]) &&
									sessionRow.stream_start_token === String(params[2]) &&
									sessionRow.cloudflare_stream_live_input_id === String(params[3])
								) {
									sessionRow.stream_notification_queued_at = null;
								} else {
									changes = 0;
								}
							}
							if (sql.includes("stream_status = 'failed'")) {
								const isActive = sessionRow.stream_status === "starting" ||
									sessionRow.stream_status === "live";
								const matches = sql.includes("AND updated_at <= ?")
									? sessionRow.stream_status === String(params[1]) &&
										sessionRow.updated_at <= Number(params[2])
									: sql.includes("AND stream_start_token = ?")
										? sessionRow.stream_start_token === String(params[1])
										: true;
								if (isActive && matches) {
									if (sessionRow.status === "live") sessionRow.status = "scheduled";
									sessionRow.stream_status = "failed";
									sessionRow.stream_start_token = null;
									sessionRow.stream_ended_at = now;
								} else {
									changes = 0;
								}
							}
							if (sql.includes("stream_status = 'ended'")) {
								if (
									params.length === 3 &&
									sql.includes("cloudflare_stream_live_input_id = ?")
								) {
									if (replaceLeaseBeforeEnd && !leaseReplacementApplied) {
										leaseReplacementApplied = true;
										sessionRow.cloudflare_stream_live_input_id =
											replaceLeaseBeforeEnd.liveInputId;
										sessionRow.stream_start_token = replaceLeaseBeforeEnd.startToken;
									}
									const matchesLease = (
										sessionRow.stream_status === "starting" ||
										sessionRow.stream_status === "live"
									) &&
										sessionRow.stream_start_token === String(params[1]) &&
										sessionRow.cloudflare_stream_live_input_id === String(params[2]);
									if (matchesLease) {
										if (sessionRow.status === "live") sessionRow.status = "scheduled";
										sessionRow.stream_status = "ended";
										sessionRow.stream_start_token = null;
										sessionRow.stream_ended_at ??= now;
									} else {
										changes = 0;
									}
								} else if (params.length === 4) {
									const token = String(params[3]);
									const matchesToken = sessionRow.stream_start_token === token;
									const canPreCancel = sessionRow.stream_start_token === null &&
										sessionRow.stream_status !== "starting" &&
										sessionRow.stream_status !== "live";
									if (matchesToken || canPreCancel) {
										if (sessionRow.status === "live") {
											sessionRow.status = "scheduled";
										}
										sessionRow.stream_status = "ended";
										sessionRow.stream_start_token = matchesToken ? null : token;
										sessionRow.stream_ended_at ??= now;
									} else {
										changes = 0;
									}
								} else {
									if (sessionRow.status === "live") {
										sessionRow.status = "scheduled";
									}
									sessionRow.stream_status = "ended";
									sessionRow.stream_start_token = null;
									sessionRow.stream_ended_at ??= now;
								}
							}
							if (changes > 0) sessionRow.updated_at = now;
						}
						return { meta: { changes, rows_written: changes } };
					},
				}),
			};
		},
	} as unknown as D1Database;

	return {
		db,
		inviteRows,
		participantRows,
		redemptionRows,
		sessionRow,
		writes,
	};
}

async function createGuestInviteFixture(maxUses = 1): Promise<{
	invite: StudioInvite;
	row: StudioInviteDbRow;
	token: string;
}> {
	const token = "guest-invite";
	const tokenHash = await hashInviteToken(token);
	const now = Math.floor(Date.now() / 1000);
	const row: StudioInviteDbRow = {
		token_hash: tokenHash,
		session_id: "rawkode-live-next",
		role: "guest",
		expires_at: now + 60 * 60,
		max_uses: maxUses,
		used_count: 0,
		created_by_id: "rawkode",
		created_by_github: "rawkode",
		created_at: now,
		revoked_at: null,
	};
	return {
		invite: {
			tokenHash,
			sessionId: row.session_id,
			role: row.role,
			expiresAt: row.expires_at,
			maxUses: row.max_uses,
			usedCount: row.used_count,
			createdById: row.created_by_id,
			createdByGithub: row.created_by_github,
			createdAt: row.created_at,
			revokedAt: row.revoked_at,
		},
		row,
		token,
	};
}

function createRealtimeKitStudioEnv(db: D1Database): StudioEnv {
	return {
		CLOUDFLARE_ACCOUNT_ID: "account-1",
		REALTIMEKIT_API_TOKEN: "token-1",
		REALTIMEKIT_APP_ID: "app-1",
		REALTIMEKIT_GUEST_PRESET: "group_call_guest",
		STUDIO_DB: db,
		STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
	} as StudioEnv;
}

function createRecordingBucketMock() {
	const objects = new Map<string, { etag: string; value: string }>();
	const uploads = new Map<
		string,
		{
			key: string;
			parts: Map<number, { body: ArrayBuffer; etag: string; partNumber: number }>;
		}
	>();
	let uploadSequence = 0;

	const objectFor = (key: string) => {
		const object = objects.get(key);
		if (!object) return null;
		return {
			etag: object.etag,
			httpEtag: object.etag,
			key,
			size: object.value.length,
			uploaded: new Date(),
		} as unknown as R2Object;
	};
	const bodyFor = (key: string) => {
		const object = objects.get(key);
		if (!object) return null;
		return {
			...objectFor(key),
			json: async () => JSON.parse(object.value),
			text: async () => object.value,
		} as unknown as R2ObjectBody;
	};

	const bucket = {
		createMultipartUpload: async (key: string) => {
			const uploadId = `upload-${++uploadSequence}`;
			uploads.set(uploadId, {
				key,
				parts: new Map(),
			});
			return { key, uploadId };
		},
		get: async (key: string) => bodyFor(key),
		head: async (key: string) => objectFor(key),
		put: async (key: string, value: BodyInit) => {
			const text = typeof value === "string"
				? value
				: await new Response(value).text();
			objects.set(key, {
				etag: `put-${objects.size + 1}`,
				value: text,
			});
			return objectFor(key);
		},
		resumeMultipartUpload: (key: string, uploadId: string) => {
			const upload = uploads.get(uploadId);
			if (!upload || upload.key !== key) {
				throw new Error(`Unknown multipart upload ${uploadId} for ${key}`);
			}
			return {
				abort: async () => {
					uploads.delete(uploadId);
				},
				complete: async (parts: R2UploadedPart[]) => {
					const buffers = parts.map((part) => {
						const uploaded = upload.parts.get(part.partNumber);
						if (!uploaded || uploaded.etag !== part.etag) {
							throw new Error(`Missing uploaded part ${part.partNumber}`);
						}
						return new Uint8Array(uploaded.body);
					});
					const size = buffers.reduce((total, part) => total + part.byteLength, 0);
					objects.set(key, {
						etag: `complete-${size}`,
						value: `multipart:${size}`,
					});
					uploads.delete(uploadId);
					return objectFor(key);
				},
				uploadPart: async (partNumber: number, body: ReadableStream) => {
					const buffer = await new Response(body).arrayBuffer();
					const part = {
						body: buffer,
						etag: `part-${partNumber}-${buffer.byteLength}`,
						partNumber,
					};
					upload.parts.set(partNumber, part);
					return {
						etag: part.etag,
						partNumber: part.partNumber,
					};
				},
			};
		},
	} as unknown as R2Bucket;

	return {
		bucket,
		putJson: (key: string, value: unknown) => {
			objects.set(key, {
				etag: `json-${objects.size + 1}`,
				value: JSON.stringify(value),
			});
		},
		text: (key: string) => objects.get(key)?.value ?? null,
	};
}

afterEach(() => {
	clearCloudflareStreamLiveInputCache();
	vi.restoreAllMocks();
});

describe("Studio session records", () => {
	it("builds session records around GitHub-backed identity", () => {
		const session = buildStudioSession({
			createdBy: user,
			meeting: { id: "meeting_123" },
			sessionId: "rawkode-live-next",
			show: "Rawkode Live",
			title: "Rawkode Live production room",
		});

		expect(session.createdByGithub).toBe("rawkode");
		expect(session.contentVideoId).toBeNull();
		expect(session.contentVideoSlug).toBeNull();
		expect(session.hosts).toEqual([
			{ githubHandle: "rawkode", id: "rawkode", name: "Rawkode" },
		]);
		expect(getStudioSessionWatchUrl(session)).toBeNull();
		expect(session.realtimeKitMeetingId).toBe("meeting_123");
		expect(session.recordingPrefix).toBe("studio/recordings/rawkode-live-next/");
		expect(session.status).toBe("scheduled");
		expect(session.streamEnvironment).toBe("test");
		expect(session.streamStatus).toBe("idle");
	});

	it("builds Rawkode watch URLs only for Prod content-backed sessions", () => {
		const session = buildStudioSession({
			contentVideoId: "video-123",
			contentVideoSlug: "future-episode",
			createdBy: user,
			meeting: null,
			sessionId: "video-123-next",
			show: "Rawkode Live",
			streamEnvironment: "prod",
			title: "Future Rawkode Live episode",
		});

		expect(getStudioSessionWatchUrl(session)).toBe(
			"https://rawkode.academy/watch/future-episode",
		);
	});

	it("prefers GitHub handles over opaque auth subjects for persisted session owners", () => {
		const session = buildStudioSession({
			createdBy: {
				...user,
				id: "github:rawkode",
				username: "Rawkode",
			},
			meeting: null,
			sessionId: "rawkode-live-next",
			show: "Rawkode Live",
			title: "Rawkode Live production room",
		});

		expect(session.createdById).toBe("rawkode");
		expect(session.createdByGithub).toBe("rawkode");
		expect(session.hosts).toContainEqual({
			githubHandle: "rawkode",
			id: "rawkode",
			name: "Rawkode",
		});
	});

	it("creates ready marker objects for the transcoding handoff contract", () => {
		const marker = createReadyMarker({
			recordingId: "recording-1",
			sourceBucket: "rawkode-recordings",
			sourceEtag: "abc123",
			sourceFormat: "mkv",
			sourceKey: "studio/recordings/rawkode-live-next/recording-1/source.mkv",
			studioSessionId: "rawkode-live-next",
			videoId: "rawkode-live/example",
		});

		expect(marker.contractVersion).toBe(1);
		expect(marker.outputPrefix).toBe("videos/rawkode-live/example/");
		expect(createReadyMarkerKey(marker.studioSessionId, marker.recordingId)).toBe(
			"studio/recordings/rawkode-live-next/recording-1/ready.json",
		);
	});

	it("lists persisted recordings with R2 transcode status", async () => {
		const requestedKeys: string[] = [];
		const studioDb = createStudioDbMock({
			recordingRows: [
				{
					recording_id: "recording-1",
					session_id: "rawkode-live-next",
					video_id: "video-123",
					source_bucket: "verified-recordings",
					source_key:
						"studio/recordings/rawkode-live-next/recording-1/source.webm",
					source_etag: "complete-etag",
					source_format: "webm",
					output_prefix: "videos/video-123",
					ready_marker_key:
						"studio/recordings/rawkode-live-next/recording-1/ready.json",
					status: "ready-marker-written",
					created_at: 100,
					updated_at: 120,
				},
			],
		});
		const recordings = {
			get: async (key: string) => {
				requestedKeys.push(key);
				return {
					json: async () => ({
						completedAt: "2026-08-01T11:00:00.000Z",
						status: "complete",
					}),
				};
			},
		} as unknown as R2Bucket;

		const result = await listStudioRecordings(
			{
				RECORDINGS: recordings,
				STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv,
			"rawkode-live-next",
		);

		expect(requestedKeys).toEqual(["videos/video-123/transcode-status.json"]);
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			handoffStatus: "ready-marker-written",
			outputPrefix: "videos/video-123",
			recordingId: "recording-1",
			sourceFormat: "webm",
			status: "vod-ready",
			transcode: {
				completedAt: "2026-08-01T11:00:00.000Z",
				status: "complete",
				statusKey: "videos/video-123/transcode-status.json",
				streamUrl: "https://content.rawkode.academy/videos/video-123/stream.m3u8",
			},
			videoId: "video-123",
		});
	});

	it("keeps recordings in waiting state when transcode status is missing", async () => {
		const studioDb = createStudioDbMock({
			recordingRows: [
				{
					recording_id: "recording-1",
					session_id: "rawkode-live-next",
					video_id: "video-123",
					source_bucket: "verified-recordings",
					source_key:
						"studio/recordings/rawkode-live-next/recording-1/source.webm",
					source_etag: "complete-etag",
					source_format: "webm",
					output_prefix: "videos/video-123/",
					ready_marker_key:
						"studio/recordings/rawkode-live-next/recording-1/ready.json",
					status: "ready-marker-written",
					created_at: 100,
					updated_at: 120,
				},
			],
		});
		const recordings = {
			get: async () => null,
		} as unknown as R2Bucket;

		await expect(
			listStudioRecordings(
				{
					RECORDINGS: recordings,
					STUDIO_DB: studioDb.db,
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
				} as StudioEnv,
				"rawkode-live-next",
			),
		).resolves.toMatchObject([
			{
				handoffStatus: "ready-marker-written",
				recordingId: "recording-1",
				status: "uploaded",
				transcode: null,
			},
		]);
	});

	it("shows recordings as transcoding while Cloud Run has not completed", async () => {
		const studioDb = createStudioDbMock({
			recordingRows: [
				{
					recording_id: "recording-1",
					session_id: "rawkode-live-next",
					video_id: "video-123",
					source_bucket: "verified-recordings",
					source_key:
						"studio/recordings/rawkode-live-next/recording-1/source.webm",
					source_etag: "complete-etag",
					source_format: "webm",
					output_prefix: "videos/video-123/",
					ready_marker_key:
						"studio/recordings/rawkode-live-next/recording-1/ready.json",
					status: "ready",
					created_at: 100,
					updated_at: 120,
				},
			],
		});
		const recordings = {
			get: async () => ({
				json: async () => ({
					status: "running",
				}),
			}),
		} as unknown as R2Bucket;

		await expect(
			listStudioRecordings(
				{
					RECORDINGS: recordings,
					STUDIO_DB: studioDb.db,
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
				} as StudioEnv,
				"rawkode-live-next",
			),
		).resolves.toMatchObject([
			{
				handoffStatus: "ready",
				recordingId: "recording-1",
				status: "transcoding",
				transcode: {
					status: "running",
					streamUrl: null,
				},
			},
		]);
	});

	it("shows recordings as failed when transcoding reports failure", async () => {
		const studioDb = createStudioDbMock({
			recordingRows: [
				{
					recording_id: "recording-1",
					session_id: "rawkode-live-next",
					video_id: "video-123",
					source_bucket: "verified-recordings",
					source_key:
						"studio/recordings/rawkode-live-next/recording-1/source.webm",
					source_etag: "complete-etag",
					source_format: "webm",
					output_prefix: "videos/video-123/",
					ready_marker_key:
						"studio/recordings/rawkode-live-next/recording-1/ready.json",
					status: "ready",
					created_at: 100,
					updated_at: 120,
				},
			],
		});
		const recordings = {
			get: async () => ({
				json: async () => ({
					status: "failed",
				}),
			}),
		} as unknown as R2Bucket;

		await expect(
			listStudioRecordings(
				{
					RECORDINGS: recordings,
					STUDIO_DB: studioDb.db,
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
				} as StudioEnv,
				"rawkode-live-next",
			),
		).resolves.toMatchObject([
			{
				handoffStatus: "ready",
				recordingId: "recording-1",
				status: "failed",
				transcode: {
					status: "failed",
					streamUrl: null,
				},
			},
		]);
	});

	it("keeps recordings visible when transcode status reads fail", async () => {
		const studioDb = createStudioDbMock({
			recordingRows: [
				{
					recording_id: "recording-r2-failure",
					session_id: "rawkode-live-next",
					video_id: "video-r2-failure",
					source_bucket: "verified-recordings",
					source_key:
						"studio/recordings/rawkode-live-next/recording-r2-failure/source.webm",
					source_etag: "complete-etag",
					source_format: "webm",
					output_prefix: "videos/video-r2-failure/",
					ready_marker_key:
						"studio/recordings/rawkode-live-next/recording-r2-failure/ready.json",
					status: "ready-marker-written",
					created_at: 100,
					updated_at: 120,
				},
				{
					recording_id: "recording-bad-json",
					session_id: "rawkode-live-next",
					video_id: "video-bad-json",
					source_bucket: "verified-recordings",
					source_key:
						"studio/recordings/rawkode-live-next/recording-bad-json/source.webm",
					source_etag: "complete-etag",
					source_format: "webm",
					output_prefix: "videos/video-bad-json/",
					ready_marker_key:
						"studio/recordings/rawkode-live-next/recording-bad-json/ready.json",
					status: "ready-marker-written",
					created_at: 90,
					updated_at: 110,
				},
			],
		});
		const recordings = {
			get: async (key: string) => {
				if (key === "videos/video-r2-failure/transcode-status.json") {
					throw new Error("R2 read failed");
				}
				return {
					json: async () => {
						throw new Error("invalid status JSON");
					},
				};
			},
		} as unknown as R2Bucket;

		await expect(
			listStudioRecordings(
				{
					RECORDINGS: recordings,
					STUDIO_DB: studioDb.db,
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
				} as StudioEnv,
				"rawkode-live-next",
			),
		).resolves.toMatchObject([
			{
				recordingId: "recording-r2-failure",
				status: "uploaded",
				transcode: null,
			},
			{
				recordingId: "recording-bad-json",
				status: "uploaded",
				transcode: null,
			},
		]);
	});
});

describe("Studio operations", () => {
	it("ships Cloudflare deployment bindings for Studio runtime state and recording handoff", () => {
		const wrangler = JSON.parse(
			readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8"),
		) as {
			d1_databases?: Array<Record<string, string>>;
			kv_namespaces?: Array<Record<string, string>>;
			name?: string;
			queues?: { producers?: Array<Record<string, string>> };
			r2_buckets?: Array<Record<string, string>>;
			routes?: Array<Record<string, string | boolean>>;
			secrets_store_secrets?: Array<Record<string, string>>;
			vars?: Record<string, string>;
		};
		const envCue = readFileSync(
			new URL("../../env.cue", import.meta.url),
			"utf8",
		);
		const packageJson = JSON.parse(
			readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
		) as {
			dependencies?: Record<string, string>;
			scripts?: Record<string, string>;
		};

		expect(wrangler.name).toBe("rawkode-academy-studio");
		expect(wrangler.routes).toContainEqual({
			pattern: "rawkode.studio",
			custom_domain: true,
		});
		expect(wrangler.kv_namespaces).toContainEqual(
			expect.objectContaining({ binding: "SESSION" }),
		);
		expect(wrangler.d1_databases).toContainEqual(
			expect.objectContaining({
				binding: "STUDIO_DB",
				database_name: "rawkode-academy-studio",
				database_id: "1fe3facd-0c47-43e2-b89d-f402e457db32",
				migrations_dir: "./data-model",
			}),
		);
		expect(wrangler.r2_buckets).toContainEqual({
			binding: "RECORDINGS",
			bucket_name: "rawkode-academy-content",
		});
		expect(wrangler.queues?.producers).toContainEqual({
			binding: "STREAM_NOTIFICATIONS",
			queue: "rawkode-academy-notifications",
		});
		expect(wrangler.vars).toMatchObject({
			CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce",
			RAWKODE_GRAPHQL_URL: "https://api.rawkode.academy/",
			REALTIMEKIT_GUEST_PRESET: "group_call_guest",
			REALTIMEKIT_HOST_PRESET: "group_call_host",
			REALTIMEKIT_PRODUCER_PRESET: "group_call_host",
			REALTIMEKIT_PROGRAM_PRESET: "group_call_host",
			RECORDINGS_BUCKET_NAME: "rawkode-academy-content",
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		});
		expect(wrangler.secrets_store_secrets).not.toContainEqual(
			expect.objectContaining({ binding: "CLOUDFLARE_ACCOUNT_ID" }),
		);
		expect(wrangler.secrets_store_secrets).not.toContainEqual(
			expect.objectContaining({ binding: "CLOUDFLARE_API_TOKEN" }),
		);
		expect(wrangler.secrets_store_secrets).toContainEqual(
			expect.objectContaining({
				binding: "REALTIMEKIT_API_TOKEN",
				secret_name: "REALTIMEKIT_API_TOKEN",
			}),
		);
		expect(wrangler.secrets_store_secrets).toContainEqual(
			expect.objectContaining({
				binding: "REALTIMEKIT_APP_ID",
				secret_name: "REALTIMEKIT_APP_ID",
			}),
		);
		expect(wrangler.secrets_store_secrets).toContainEqual(
			expect.objectContaining({
				binding: "CLOUDFLARE_STREAM_API_TOKEN",
				secret_name: "CLOUDFLARE_STREAM_API_TOKEN",
			}),
		);
		expect(packageJson.scripts).toMatchObject({
			deploy: "bun x wrangler deploy",
			migrate: "bun x wrangler d1 migrations apply rawkode-academy-studio --remote",
			"verify:live": "bun run scripts/verify-live.ts",
		});
		expect(packageJson.dependencies).toMatchObject({
			notifications: "workspace:*",
		});
		expect(envCue).toContain("CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef");
		expect(envCue).toContain("op://sa.rawkode.academy/cloudflare/api-tokens/workers");
		expect(envCue).toContain("tasks: [_t.migrations.remote, _t.check, _t.test, _t.deploy.main]");
		expect(envCue).toContain('tasks: [_t.check, _t.test, _t.deploy."dry-run"]');
		expect(envCue).toContain('args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run migrate"]');
		expect(envCue).toContain('args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run deploy:dry-run"]');
		expect(envCue).toContain("env: PATH: _taskPath");
	});

	it("restricts production WebRTC playback to Rawkode-owned origins", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			expect(JSON.parse(String(init?.body))).toMatchObject({
				recording: {
					allowedOrigins: ["rawkode.academy", "rawkode.studio"],
					requireSignedURLs: false,
				},
			});
			return new Response(JSON.stringify({
				success: true,
				result: { uid: "live-input-1" },
			}));
		});
		vi.stubGlobal("fetch", fetchMock);

		await createCloudflareStreamLiveInput({
			accountId: "account-1",
			apiToken: "stream-token",
		}, {
			contentVideoSlug: "future-event",
			name: "Future event",
			sessionId: "rawkode-live-next",
			streamEnvironment: "prod",
		});
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it("initializes the RealtimeKit room bridge with setup-owned join lifecycle", () => {
		const roomBridge = readFileSync(
			new URL("../components/RealtimeKitRoom.vue", import.meta.url),
			"utf8",
		);
		const studioApp = readFileSync(new URL("../App.vue", import.meta.url), "utf8");

		expect(roomBridge).toContain("defaults: { audio: true, video: true }");
		expect(roomBridge).toContain('show-setup-screen="true"');
		expect(roomBridge).toContain("observeRealtimeKitRoomLifecycle");
		expect(roomBridge).toContain("getRealtimeKitRoomSetupState(nextMeeting)");
		expect(roomBridge).not.toContain("join.call(nextMeeting)");
		expect(roomBridge).toContain('"media-streams-change": [payload: {');
		expect(roomBridge).toContain("participant.audioTrack");
		expect(roomBridge).toContain("participant.videoTrack");
		expect(roomBridge).toContain("source-guest-camera");
		expect(roomBridge).toContain("source-producer-camera");
		expect(roomBridge).toContain("screenShareTracks");
		expect(roomBridge).toContain("customParticipantId?.match(/^studio:(guest|host|producer|program):/");
		expect(studioApp).toContain("const roomMediaStreams = shallowRef(new Map<string, MediaStream>())");
		expect(studioApp).toContain("const roomMediaSources = shallowRef(new Map<string, StudioSource>())");
		expect(studioApp).toContain("const streams = new Map<string, MediaStream>(roomMediaStreams.value)");
		expect(studioApp).toContain('@media-streams-change="syncRoomMediaStreams"');
	});

	it("ships an additive D1 migration for content-backed sessions", () => {
		const migration = readFileSync(
			new URL("../../data-model/0001_content_video_sessions.sql", import.meta.url),
			"utf8",
		);
		const slugMigration = readFileSync(
			new URL("../../data-model/0002_content_video_slugs.sql", import.meta.url),
			"utf8",
		);
		const streamMigration = readFileSync(
			new URL("../../data-model/0003_stream_state.sql", import.meta.url),
			"utf8",
		);
		const participantProvisioningMigration = readFileSync(
			new URL("../../data-model/0004_participant_provisioning.sql", import.meta.url),
			"utf8",
		);

		expect(migration).toContain("ADD COLUMN content_video_id TEXT");
		expect(migration).toContain(
			"ADD COLUMN content_hosts_json TEXT NOT NULL DEFAULT '[]'",
		);
		expect(migration).toContain(
			"ADD COLUMN content_guests_json TEXT NOT NULL DEFAULT '[]'",
		);
		expect(slugMigration).toContain("ADD COLUMN content_video_slug TEXT");
		expect(streamMigration).toContain("ADD COLUMN stream_environment TEXT");
		expect(streamMigration).toContain("ADD COLUMN stream_status TEXT");
		expect(streamMigration).toContain("ADD COLUMN cloudflare_stream_live_input_id TEXT");
		expect(streamMigration).toContain("ADD COLUMN cloudflare_stream_playback_url TEXT");
		expect(streamMigration).toContain("ADD COLUMN stream_notification_queued_at INTEGER");
		expect(streamMigration).toContain("ADD COLUMN stream_start_token TEXT");
		expect(participantProvisioningMigration).toContain(
			"ADD COLUMN state TEXT NOT NULL DEFAULT 'redeemed'",
		);
		expect(participantProvisioningMigration).toContain("ADD COLUMN claim_id TEXT");
		expect(participantProvisioningMigration).toContain("ADD COLUMN finalized_at INTEGER");
		expect(participantProvisioningMigration).toContain(
			"ADD COLUMN realtimekit_custom_participant_id TEXT",
		);
		expect(participantProvisioningMigration).toContain(
			"ADD COLUMN realtimekit_participant_id TEXT",
		);
		expect(participantProvisioningMigration).toContain(
			"ADD COLUMN provisioning_state TEXT NOT NULL DEFAULT 'unknown'",
		);
		expect(participantProvisioningMigration).toContain(
			"studio_participants_realtimekit_identity_idx",
		);
		expect(participantProvisioningMigration).toContain(
			"SET finalized_at = redeemed_at",
		);
		expect(participantProvisioningMigration).toContain(
			"studio_invite_redemptions.state = 'redeemed'",
		);
	});

	it("keeps active stream state stable across session upserts and notification claims", () => {
		const studioSource = readFileSync(
			new URL("./studio.ts", import.meta.url),
			"utf8",
		);

		expect(studioSource).toContain(
			"WHEN studio_sessions.status <> 'scheduled' THEN studio_sessions.status",
		);
		expect(studioSource).toContain(
			"stream_status = studio_sessions.stream_status",
		);
		expect(studioSource).toContain(
			"cloudflare_stream_live_input_id = studio_sessions.cloudflare_stream_live_input_id",
		);
		expect(studioSource).toContain(
			"stream_notification_queued_at = studio_sessions.stream_notification_queued_at",
		);
		expect(studioSource).toContain("AND stream_environment = 'prod'");
		expect(studioSource).toContain("AND stream_status = 'live'");
		expect(studioSource).toContain("AND status = 'live'");
	});

	it("resolves guest invite landing pages with the signed-in GitHub user", () => {
		const route = readFileSync(
			new URL("../pages/guest/[inviteToken].astro", import.meta.url),
			"utf8",
		);

		expect(route).toMatch(
			/resolveStudioInvite\(\s*env,\s*inviteToken,\s*Astro\.locals\.user,?\s*\)/s,
		);
	});

	it("keeps the demo guest invite behind an explicit development flag", async () => {
		const prepare = vi.fn();

		const resolved = await resolveStudioInvite(
			{
				STUDIO_DB: { prepare } as unknown as D1Database,
				STUDIO_ENABLE_DEMO_INVITE: "true",
			} as StudioEnv,
			"demo",
			guestUser,
		);

		expect(resolved?.invite.tokenHash).toBe("demo");
		expect(resolved?.session.id).toBe("rawkode-live-next");
		expect(prepare).not.toHaveBeenCalled();
	});

	it("does not enable the demo guest invite by default", async () => {
		const studioDb = createStudioDbMock();

		await expect(resolveStudioInvite(
			{ STUDIO_DB: studioDb.db } as StudioEnv,
			"demo",
			guestUser,
		)).resolves.toBeNull();
	});

	it("treats a missing local invite table as an unavailable invite", async () => {
		const missingInviteTableDb = {
			prepare: () => ({
				bind: () => ({
					first: async () => {
						throw new Error(
							"D1_ERROR: no such table: studio_invites: SQLITE_ERROR",
						);
					},
				}),
			}),
		} as unknown as D1Database;

		await expect(
			resolveStudioInvite(
				{
					STUDIO_DB: missingInviteTableDb,
				} as StudioEnv,
				"abc123",
				guestUser,
			),
		).resolves.toBeNull();
	});

	it("links VOD-ready content-backed recordings to the Rawkode watch page", () => {
		const route = readFileSync(
			new URL("../pages/studio/[sessionId]/recordings.astro", import.meta.url),
			"utf8",
		);

		expect(route).toContain("getStudioSessionWatchUrl(session)");
		expect(route).toContain("<dt>WATCH_URL</dt>");
		expect(route).toContain('recording.status === "vod-ready"');
		expect(route).toContain("recording.isRehearsal");
	});

	it("does not expose Studio sessions on anonymous dashboards", async () => {
		await expect(loadStudioDashboard(undefined, {} as StudioEnv)).resolves.toMatchObject({
			events: [],
			isOperator: false,
			sessions: [],
			user: null,
		});
	});

	it("shows operators all upcoming content events with their RTK sessions", async () => {
		const studioDb = createStudioDbMock({
			content_video_id: "future-video",
			realtimekit_meeting_id: "meeting-1",
			status: "live",
			title: "Future Rawkode Live episode",
		});
		const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
			new Response(
				JSON.stringify({
					data: {
						getUpcomingVideos: [
							{
								id: "future-video",
								slug: "future-event",
								title: "Future event",
								publishedAt: "2026-08-01T10:00:00.000Z",
								guests: [],
								episode: {
									show: {
										id: "rawkode-live",
										name: "Rawkode Live",
										hosts: [],
									},
								},
							},
						],
					},
				}),
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			loadStudioDashboard(user, {
				RAWKODE_GRAPHQL_URL: "https://content.example/graphql",
				STUDIO_DB: studioDb.db,
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv),
		).resolves.toMatchObject({
			events: [
				{
					id: "future-video",
					sessions: [
						{
							id: "rawkode-live-next",
							realtimeKitMeetingId: "meeting-1",
							status: "live",
						},
					],
				},
			],
			isOperator: true,
		});
		const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}")) as {
			query?: string;
		};
		expect(request.query).toContain("getUpcomingVideos");
		expect(request.query).not.toContain("getAllVideos");
	});

	it("reconciles disconnected Cloudflare inputs on operator dashboard reads", async () => {
		const studioDb = createStudioDbMock({
			cloudflare_stream_live_input_id: "dashboard-live-input",
			cloudflare_stream_playback_url: "https://stream.example/webRTC/play",
			status: "live",
			stream_environment: "prod",
			stream_start_token: "dashboard-publisher-token",
			stream_status: "live",
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				if (String(input) === "https://content.example/graphql") {
					return new Response(
						JSON.stringify({ data: { getUpcomingVideos: [] } }),
					);
				}

				return new Response(
					JSON.stringify({
						success: true,
						result: {
							status: "client_disconnect",
							uid: "dashboard-live-input",
						},
					}),
				);
			}),
		);

		await expect(
			loadStudioDashboard(user, {
				CLOUDFLARE_ACCOUNT_ID: "account-1",
				CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
				RAWKODE_GRAPHQL_URL: "https://content.example/graphql",
				STUDIO_DB: studioDb.db,
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv),
		).resolves.toMatchObject({
			sessions: [
				{
					status: "scheduled",
					streamStatus: "ended",
				},
			],
		});
		expect(studioDb.sessionRow.status).toBe("scheduled");
		expect(studioDb.sessionRow.stream_status).toBe("ended");
	});

	it("does not expose the Studio control plane to non-operators", async () => {
		const studioDb = createStudioDbMock({
			content_guests_json: JSON.stringify([
				{
					id: "guest",
					name: "Guest",
					githubHandle: "guest",
					avatarUrl: null,
				},
			]),
			content_video_id: "assigned-video",
			realtimekit_meeting_id: "meeting-1",
			status: "live",
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				new Response(
					JSON.stringify({
						data: {
							getAllVideos: [
								{
									id: "assigned-video",
									slug: "assigned-event",
									title: "Assigned event",
									publishedAt: "2026-08-01T10:00:00.000Z",
									guests: [
										{
											id: "guest",
											name: "Guest",
											githubHandle: "guest",
											avatarUrl: null,
										},
									],
									episode: null,
								},
								{
									id: "unassigned-video",
									slug: "unassigned-event",
									title: "Unassigned event",
									publishedAt: "2026-08-02T10:00:00.000Z",
									guests: [],
									episode: null,
								},
							],
						},
					}),
				),
			),
		);

		await expect(
			loadStudioDashboard(guestUser, {
				RAWKODE_GRAPHQL_URL: "https://content.example/graphql",
				STUDIO_DB: studioDb.db,
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv),
		).resolves.toMatchObject({
			events: [],
			isOperator: false,
			sessions: [],
		});
		expect(fetch).not.toHaveBeenCalled();
	});

	it("derives dashboard session recording status from the latest VOD status", async () => {
		const studioDb = createStudioDbMock({
			recording_status: "uploaded",
			recordingRows: [
				{
					recording_id: "recording-1",
					session_id: "rawkode-live-next",
					video_id: "video-123",
					source_bucket: "verified-recordings",
					source_key:
						"studio/recordings/rawkode-live-next/recording-1/source.webm",
					source_etag: "complete-etag",
					source_format: "webm",
					output_prefix: "videos/video-123/",
					ready_marker_key:
						"studio/recordings/rawkode-live-next/recording-1/ready.json",
					status: "ready",
					created_at: 100,
					updated_at: 120,
				},
			],
		});
		const recordings = {
			get: async () => ({
				json: async () => ({
					completedAt: "2026-08-01T11:00:00.000Z",
					status: "complete",
				}),
			}),
		} as unknown as R2Bucket;

		await expect(
			loadStudioDashboard(user, {
				RECORDINGS: recordings,
				STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv),
		).resolves.toMatchObject({
			sessions: [
				{
					id: "rawkode-live-next",
					recordingStatus: "vod-ready",
				},
			],
		});
	});

	it("keeps actively recording sessions ahead of older VOD output", async () => {
		const studioDb = createStudioDbMock({
			recording_status: "recording",
			recordingRows: [
				{
					recording_id: "recording-1",
					session_id: "rawkode-live-next",
					video_id: "video-123",
					source_bucket: "verified-recordings",
					source_key:
						"studio/recordings/rawkode-live-next/recording-1/source.webm",
					source_etag: "complete-etag",
					source_format: "webm",
					output_prefix: "videos/video-123/",
					ready_marker_key:
						"studio/recordings/rawkode-live-next/recording-1/ready.json",
					status: "ready",
					created_at: 100,
					updated_at: 120,
				},
			],
		});
		const recordings = {
			get: async () => ({
				json: async () => ({
					completedAt: "2026-08-01T11:00:00.000Z",
					status: "complete",
				}),
			}),
		} as unknown as R2Bucket;

		await expect(
			loadStudioDashboard(user, {
				RECORDINGS: recordings,
				STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv),
		).resolves.toMatchObject({
			sessions: [
				{
					id: "rawkode-live-next",
					recordingStatus: "recording",
				},
			],
		});
	});

	it("does not create provider meetings when session storage is unavailable", async () => {
		await expect(
			createStudioSession({} as StudioEnv, user, {
				show: "Rawkode Live",
				title: "Rawkode Live production room",
			}),
		).rejects.toMatchObject({
			code: "storage-not-configured",
			status: 503,
		});
	});

	it("requires exact production arming confirmation", async () => {
		for (const prodConfirmation of [undefined, "prod", "PRODUCTION"]) {
			const studioDb = createStudioDbMock();
			await expect(createStudioSession(
				{
					STUDIO_DB: studioDb.db,
					STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
				} as StudioEnv,
				user,
				{
					prodConfirmation,
					show: "Rawkode Live",
					streamEnvironment: "prod",
					title: "Rawkode Live production room",
				},
			)).rejects.toMatchObject({ code: "bad-request", status: 400 });
		}
	});

	it("creates Studio sessions from content graph video metadata", async () => {
		const studioDb = createStudioDbMock();
		const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
			new Response(
				JSON.stringify({
					data: {
						videoByID: {
							id: "video-123",
							slug: "future-episode",
							title: "Future Rawkode Live episode",
							publishedAt: "2026-08-01T10:00:00.000Z",
							guests: [
								{
									id: "steveklabnik",
									name: "Steve Klabnik",
									githubHandle: "steveklabnik",
									avatarUrl: "https://example.com/steve.png",
								},
							],
							episode: {
								show: {
									id: "rawkode-live",
									name: "Rawkode Live",
									hosts: [
										{
											id: "rawkode",
											name: "Rawkode",
											githubHandle: "rawkode",
											avatarUrl: "https://example.com/rawkode.png",
										},
									],
								},
							},
						},
						episodeByVideoId: null,
					},
				}),
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		const result = await createStudioSession(
			{
				RAWKODE_GRAPHQL_URL: "https://content.example/graphql",
				STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv,
			user,
			{
				videoId: "video-123",
			},
		);

		expect(fetchMock).toHaveBeenCalledWith(
			"https://content.example/graphql",
			expect.objectContaining({ method: "POST" }),
		);
		expect(result.session.contentVideoId).toBe("video-123");
		expect(result.session.contentVideoSlug).toBe("future-episode");
		expect(result.session.title).toBe("Future Rawkode Live episode");
		expect(result.session.showId).toBe("rawkode-live");
		expect(result.session.show).toBe("Rawkode Live");
		expect(result.session.startsAt).toBe("2026-08-01T10:00:00.000Z");
		expect(result.session.guests).toEqual([
			{
				avatarUrl: "https://example.com/steve.png",
				githubHandle: "steveklabnik",
				id: "steveklabnik",
				name: "Steve Klabnik",
			},
		]);
		expect(
			studioDb.writes.some((write) =>
				write.params.includes("video-123") &&
				write.params.includes("future-episode") &&
				write.params.includes("Future Rawkode Live episode"),
			),
		).toBe(true);
		expect(result.session.streamEnvironment).toBe("test");
		expect(getStudioSessionWatchUrl(result.session)).toBeNull();
	});

	it("keeps RealtimeKit room creation scheduled until the stream is confirmed live", async () => {
		const studioDb = createStudioDbMock();
		const apiTokenSecret = createSecretsStoreRpcBinding(" rtk-token ");
		const appIdSecret = createSecretsStoreRpcBinding(" app-1 ");
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				new Response(
					JSON.stringify({
						success: true,
						result: {
							id: "meeting-1",
							title: "Rawkode Live production room",
						},
					}),
				),
			),
		);

		const result = await createStudioSession(
			{
				CLOUDFLARE_ACCOUNT_ID: "account-1",
				REALTIMEKIT_API_TOKEN: apiTokenSecret.binding,
				REALTIMEKIT_APP_ID: appIdSecret.binding,
				STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv,
			user,
			{
				prodConfirmation: "PROD",
				show: "Rawkode Live",
				streamEnvironment: "prod",
				title: "Rawkode Live production room",
			},
		);

		expect(result.meeting?.id).toBe("meeting-1");
		expect(result.session.status).toBe("scheduled");
		expect(result.session.streamEnvironment).toBe("prod");
		expect(result.session.streamStatus).toBe("idle");
		expect(apiTokenSecret.get).toHaveBeenCalledOnce();
		expect(appIdSecret.get).toHaveBeenCalledOnce();
	});

	it("starts and confirms test Stream publishing without queueing notifications", async () => {
		const studioDb = createStudioDbMock({
			content_video_id: "video-123",
			content_video_slug: "future-event",
			stream_environment: "test",
		});
		const queue = { send: vi.fn() };
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			expect(url).toContain("/stream/live_inputs");
			if (init?.method === "POST") {
				expect(JSON.parse(String(init.body))).toMatchObject({
					recording: {
						allowedOrigins: ["rawkode.studio"],
						requireSignedURLs: false,
					},
				});
				return new Response(
					JSON.stringify({
						success: true,
						result: {
							uid: "live-input-1",
							status: "new_configuration_accepted",
							webRTC: { url: "https://stream.example/webRTC/publish" },
							webRTCPlayback: { url: "https://stream.example/webRTC/play" },
						},
					}),
				);
			}
			return new Response(
				JSON.stringify({
					success: true,
					result: {
						uid: "live-input-1",
						status: "connected",
						webRTCPlayback: { url: "https://stream.example/webRTC/play" },
					},
				}),
			);
		});
		vi.stubGlobal("fetch", fetchMock);
		const env = {
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STREAM_NOTIFICATIONS: queue,
			STUDIO_DB: studioDb.db,
		STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as unknown as StudioEnv;

		const start = await startStudioStream(env, user, {
			sessionId: "rawkode-live-next",
		});
		expect(start).toMatchObject({
			liveInputId: "live-input-1",
			playbackUrl: "https://stream.example/webRTC/play",
			publishUrl: "https://stream.example/webRTC/publish",
			streamStatus: "starting",
		});
		expect(start.streamToken).toEqual(expect.any(String));
		await expect(
			confirmStudioStream(env, user, {
				sessionId: "rawkode-live-next",
				streamToken: start.streamToken,
			}),
		).resolves.toEqual({
			sessionId: "rawkode-live-next",
			streamStatus: "live",
			notified: false,
		});

		expect(queue.send).not.toHaveBeenCalled();
		await expect(getStudioSession(env, "rawkode-live-next")).resolves.toMatchObject({
			status: "scheduled",
			streamStatus: "live",
		});
		await expect(getPublicStudioLiveState(env, "future-event")).resolves.toMatchObject({
			live: false,
		});
	});

	it("keeps public playback live while Cloudflare reports an active input", async () => {
		const studioDb = createStudioDbMock({
			cloudflare_stream_live_input_id: "live-input-connected",
			cloudflare_stream_playback_url: "https://stream.example/webRTC/play",
			content_video_id: "video-123",
			content_video_slug: "future-event",
			status: "live",
			stream_environment: "prod",
			stream_start_token: "publisher-token",
			stream_status: "live",
		});
		vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
			success: true,
			result: { uid: "live-input-connected", status: "connected" },
		}))));

		await expect(getPublicStudioLiveState({
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STUDIO_DB: studioDb.db,
		} as StudioEnv, "future-event")).resolves.toMatchObject({
			live: true,
			playbackUrl: "https://stream.example/webRTC/play",
		});
		expect(studioDb.sessionRow.stream_status).toBe("live");
	});

	it("atomically removes public playback after Cloudflare disconnects", async () => {
		const studioDb = createStudioDbMock({
			cloudflare_stream_live_input_id: "live-input-disconnected",
			cloudflare_stream_playback_url: "https://stream.example/webRTC/play",
			content_video_id: "video-123",
			content_video_slug: "future-event",
			status: "live",
			stream_environment: "prod",
			stream_start_token: "publisher-token",
			stream_status: "live",
		});
		vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
			success: true,
			result: { uid: "live-input-disconnected", status: "client_disconnect" },
		}))));

		await expect(getPublicStudioLiveState({
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STUDIO_DB: studioDb.db,
		} as StudioEnv, "future-event")).resolves.toEqual({
			live: false,
			playbackUrl: null,
			session: null,
		});
		expect(studioDb.sessionRow.stream_status).toBe("ended");
		expect(studioDb.sessionRow.status).toBe("scheduled");
		expect(studioDb.writes.some((write) =>
			write.sql.includes("cloudflare_stream_live_input_id = ?")
		)).toBe(true);
	});

	it("does not end public playback on a transient Cloudflare API error", async () => {
		const studioDb = createStudioDbMock({
			cloudflare_stream_live_input_id: "live-input-provider-error",
			cloudflare_stream_playback_url: "https://stream.example/webRTC/play",
			content_video_id: "video-123",
			content_video_slug: "future-event",
			status: "live",
			stream_environment: "prod",
			stream_start_token: "publisher-token",
			stream_status: "live",
		});
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
			errors: [{ message: "temporarily unavailable" }],
			success: false,
		}), { status: 503 })));

		await expect(getPublicStudioLiveState({
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STUDIO_DB: studioDb.db,
		} as StudioEnv, "future-event")).resolves.toMatchObject({ live: true });
		expect(studioDb.sessionRow.stream_status).toBe("live");
		expect(studioDb.writes.some((write) =>
			write.sql.includes("cloudflare_stream_live_input_id = ?")
		)).toBe(false);
	});

	it("does not apply a stale disconnect result to a replacement publisher token", async () => {
		const studioDb = createStudioDbMock({
			cloudflare_stream_live_input_id: "live-input-race",
			cloudflare_stream_playback_url: "https://stream.example/webRTC/play-old",
			content_video_id: "video-123",
			content_video_slug: "future-event",
			status: "live",
			stream_environment: "prod",
			stream_start_token: "old-token",
			stream_status: "live",
		});
		vi.stubGlobal("fetch", vi.fn(async () => {
			studioDb.sessionRow.stream_start_token = "replacement-token";
			studioDb.sessionRow.cloudflare_stream_playback_url =
				"https://stream.example/webRTC/play-new";
			return new Response(JSON.stringify({
				success: true,
				result: { uid: "live-input-race", status: "client_disconnect" },
			}));
		}));

		await expect(getPublicStudioLiveState({
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STUDIO_DB: studioDb.db,
		} as StudioEnv, "future-event")).resolves.toMatchObject({
			live: true,
			playbackUrl: "https://stream.example/webRTC/play-new",
		});
		expect(studioDb.sessionRow.stream_start_token).toBe("replacement-token");
		expect(studioDb.sessionRow.stream_status).toBe("live");
	});

	it("requires content metadata before starting prod Stream publishing", async () => {
		const studioDb = createStudioDbMock({
			stream_environment: "prod",
		});

		await expect(
			startStudioStream(
				{
					CLOUDFLARE_ACCOUNT_ID: "account-1",
					CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
					STUDIO_DB: studioDb.db,
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
				} as StudioEnv,
				user,
				{ sessionId: "rawkode-live-next" },
			),
		).rejects.toMatchObject({
			code: "bad-request",
			status: 400,
		});
	});

	it("rejects starting another Stream publish while one is active", async () => {
		for (const streamStatus of ["starting", "live"] as const) {
			const studioDb = createStudioDbMock({
				content_video_id: "video-123",
				content_video_slug: "future-event",
				stream_environment: "prod",
				stream_status: streamStatus,
			});

			await expect(
				startStudioStream(
					{
						CLOUDFLARE_ACCOUNT_ID: "account-1",
						CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
						STUDIO_DB: studioDb.db,
					STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
					} as StudioEnv,
					user,
					{ sessionId: "rawkode-live-next" },
				),
			).rejects.toMatchObject({
				code: "stream-active",
				status: 409,
			});
		}
	});

	it("requires the active publisher token for stop and supports explicit reset", async () => {
		const studioDb = createStudioDbMock({
			stream_start_token: "publisher-token",
			stream_status: "live",
		});
		const env = {
			STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as StudioEnv;

		await expect(stopStudioStream(env, user, {
			sessionId: "rawkode-live-next",
		})).rejects.toMatchObject({ code: "stream-active", status: 409 });
		await expect(stopStudioStream(env, user, {
			sessionId: "rawkode-live-next",
			streamToken: "wrong-token",
		})).rejects.toMatchObject({ code: "stream-active", status: 409 });

		await expect(resetStudioStream(env, user, {
			sessionId: "rawkode-live-next",
			streamToken: "publisher-token",
		})).resolves.toEqual({
			reset: true,
			sessionId: "rawkode-live-next",
			streamStatus: "failed",
		});
		await expect(resetStudioStream(env, user, {
			sessionId: "rawkode-live-next",
		})).resolves.toEqual({
			reset: false,
			sessionId: "rawkode-live-next",
			streamStatus: "failed",
		});
	});

	it("reclaims an abandoned starting lease", async () => {
		const studioDb = createStudioDbMock({
			stream_start_token: "abandoned-token",
			stream_status: "starting",
			updated_at: Math.floor(Date.now() / 1000) - 121,
		});
		vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
			success: true,
			result: {
				uid: "live-input-1",
				status: "new_configuration_accepted",
				webRTC: { url: "https://stream.example/webRTC/publish" },
				webRTCPlayback: { url: "https://stream.example/webRTC/play" },
			},
		}))));

		await expect(startStudioStream({
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STUDIO_DB: studioDb.db,
		STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as StudioEnv, user, {
			sessionId: "rawkode-live-next",
		})).resolves.toMatchObject({
			recovered: true,
			streamStatus: "starting",
		});
	});

	it("reclaims a stale live claim only after the provider disconnects", async () => {
		const studioDb = createStudioDbMock({
			cloudflare_stream_live_input_id: "live-input-1",
			cloudflare_stream_playback_url: "https://stream.example/webRTC/play",
			stream_start_token: "abandoned-token",
			stream_status: "live",
			updated_at: Math.floor(Date.now() / 1000) - 31,
		});
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({
			success: true,
			result: {
				uid: "live-input-1",
				status: "disconnected",
				webRTC: { url: "https://stream.example/webRTC/publish" },
				webRTCPlayback: { url: "https://stream.example/webRTC/play" },
			},
		})));
		vi.stubGlobal("fetch", fetchMock);

		await expect(startStudioStream({
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STUDIO_DB: studioDb.db,
		STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as StudioEnv, user, {
			sessionId: "rawkode-live-next",
		})).resolves.toMatchObject({
			recovered: true,
			streamStatus: "starting",
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("atomically rejects concurrent Stream start requests", async () => {
		const studioDb = createStudioDbMock({
			content_video_id: "video-123",
			content_video_slug: "future-event",
			stream_environment: "prod",
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				new Response(
					JSON.stringify({
						success: true,
						result: {
							uid: "live-input-1",
							status: "new_configuration_accepted",
							webRTC: { url: "https://stream.example/webRTC/publish" },
							webRTCPlayback: { url: "https://stream.example/webRTC/play" },
						},
					}),
				),
			),
		);
		const env = {
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STUDIO_DB: studioDb.db,
		STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as StudioEnv;

		const results = await Promise.allSettled([
			startStudioStream(env, user, { sessionId: "rawkode-live-next" }),
			startStudioStream(env, user, { sessionId: "rawkode-live-next" }),
		]);

		expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
		const rejected = results.find((result) => result.status === "rejected");
		expect(rejected).toMatchObject({
			reason: expect.objectContaining({
				code: "stream-active",
				status: 409,
			}),
		});
	});

	it("rejects a start whose client token was already cancelled", async () => {
		const studioDb = createStudioDbMock({
			content_video_id: "video-123",
			content_video_slug: "future-event",
			stream_environment: "prod",
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				new Response(
					JSON.stringify({
						success: true,
						result: {
							uid: "live-input-1",
							status: "new_configuration_accepted",
							webRTC: { url: "https://stream.example/webRTC/publish" },
							webRTCPlayback: { url: "https://stream.example/webRTC/play" },
						},
					}),
				),
			),
		);
		const env = {
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STUDIO_DB: studioDb.db,
		STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as StudioEnv;

		await stopStudioStream(env, user, {
			sessionId: "rawkode-live-next",
			streamToken: "cancelled-token",
		});
		await expect(
			startStudioStream(env, user, {
				sessionId: "rawkode-live-next",
				streamToken: "cancelled-token",
			}),
		).rejects.toMatchObject({
			code: "stream-active",
			status: 409,
		});
		await expect(
			startStudioStream(env, user, {
				sessionId: "rawkode-live-next",
				streamToken: "fresh-token",
			}),
		).resolves.toMatchObject({
			streamStatus: "starting",
		});
	});

	it("keeps stale Stream starts from mutating newer starts", async () => {
		const studioDb = createStudioDbMock({
			content_video_id: "video-123",
			content_video_slug: "future-event",
			stream_environment: "prod",
		});
		let resolveFirstFetch!: (response: Response) => void;
		const firstFetch = new Promise<Response>((resolve) => {
			resolveFirstFetch = resolve;
		});
		const fetchMock = vi.fn((_input: RequestInfo | URL) => {
			if (fetchMock.mock.calls.length === 1) {
				return firstFetch;
			}
			return Promise.resolve(
				new Response(
					JSON.stringify({
						success: true,
						result: {
							uid: "live-input-2",
							status: "new_configuration_accepted",
							webRTC: { url: "https://stream.example/webRTC/publish-2" },
							webRTCPlayback: { url: "https://stream.example/webRTC/play-2" },
						},
					}),
				),
			);
		});
		vi.stubGlobal("fetch", fetchMock);
		const env = {
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STUDIO_DB: studioDb.db,
		STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as StudioEnv;

		const staleStart = startStudioStream(env, user, {
			sessionId: "rawkode-live-next",
			streamToken: "stale-token",
		});
		for (let attempt = 0; attempt < 20 && fetchMock.mock.calls.length === 0; attempt += 1) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
		expect(fetchMock).toHaveBeenCalledTimes(1);
		await stopStudioStream(env, user, {
			sessionId: "rawkode-live-next",
			streamToken: "stale-token",
		});
		const currentStart = await startStudioStream(env, user, {
			sessionId: "rawkode-live-next",
		});
		expect(currentStart).toMatchObject({
			liveInputId: "live-input-2",
			streamStatus: "starting",
		});

		resolveFirstFetch(
			new Response(
				JSON.stringify({
					success: true,
					result: {
						uid: "live-input-1",
						status: "new_configuration_accepted",
						webRTC: { url: "https://stream.example/webRTC/publish-1" },
						webRTCPlayback: { url: "https://stream.example/webRTC/play-1" },
					},
				}),
			),
		);
		await expect(staleStart).rejects.toMatchObject({
			code: "bad-request",
			status: 409,
		});
		await expect(getStudioSession(env, "rawkode-live-next")).resolves.toMatchObject({
			cloudflareStreamLiveInputId: "live-input-2",
			cloudflareStreamPlaybackUrl: "https://stream.example/webRTC/play-2",
			streamStatus: "starting",
		});
	});

	it("queues prod stream notifications once after Cloudflare Stream connects", async () => {
		const studioDb = createStudioDbMock({
			content_video_id: "video-123",
			content_video_slug: "future-event",
			stream_environment: "prod",
			title: "Future Rawkode Live episode",
		});
		const queue = { send: vi.fn(async () => undefined) };
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
				new Response(
					JSON.stringify({
						success: true,
						result: {
							uid: "live-input-1",
							status: init?.method === "POST" ? "new_configuration_accepted" : "connected",
							webRTC: { url: "https://stream.example/webRTC/publish" },
							webRTCPlayback: { url: "https://stream.example/webRTC/play" },
						},
					}),
				),
			),
		);
		const env = {
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STREAM_NOTIFICATIONS: queue,
			STUDIO_DB: studioDb.db,
		STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as unknown as StudioEnv;

		const start = await startStudioStream(env, user, {
			sessionId: "rawkode-live-next",
		});
		await expect(
			confirmStudioStream(env, user, {
				sessionId: "rawkode-live-next",
				streamToken: start.streamToken,
			}),
		).resolves.toMatchObject({
			notified: true,
			streamStatus: "live",
		});
		await expect(confirmStudioStream(env, user, {
			sessionId: "rawkode-live-next",
			streamToken: start.streamToken,
		}))
			.resolves.toMatchObject({
				notified: false,
				streamStatus: "live",
			});

		expect(queue.send).toHaveBeenCalledTimes(1);
		expect(queue.send).toHaveBeenCalledWith({
			subjectKey: "stream:future-event",
			title: "Future Rawkode Live episode is live",
			body: "The stream has started on Rawkode Academy.",
			url: "https://rawkode.academy/watch/future-event",
			tag: "stream:future-event",
			data: {
				cloudflareStreamLiveInputId: "live-input-1",
				studioSessionId: "rawkode-live-next",
				videoId: "video-123",
				videoSlug: "future-event",
			},
		});
		await expect(getPublicStudioLiveState(env, "future-event")).resolves.toMatchObject({
			live: true,
			playbackUrl: "https://stream.example/webRTC/play",
			session: {
				id: "rawkode-live-next",
				title: "Future Rawkode Live episode",
			},
		});
		await expect(
			stopStudioStream(env, user, {
				sessionId: "rawkode-live-next",
				streamToken: start.streamToken,
			}),
		).resolves.toEqual({
			changed: true,
			sessionId: "rawkode-live-next",
			streamStatus: "ended",
		});
		await expect(getPublicStudioLiveState(env, "future-event")).resolves.toMatchObject({
			live: false,
		});
	});

	it("rejects an already-live confirm from the wrong publisher token without notifying", async () => {
		const studioDb = createStudioDbMock({
			cloudflare_stream_live_input_id: "live-input-current",
			cloudflare_stream_playback_url: "https://stream.example/webRTC/play",
			content_video_id: "video-123",
			content_video_slug: "future-event",
			status: "live",
			stream_environment: "prod",
			stream_start_token: "current-publisher-token",
			stream_status: "live",
			title: "Future Rawkode Live episode",
		});
		const queue = { send: vi.fn(async () => undefined) };
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const env = {
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STREAM_NOTIFICATIONS: queue,
			STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as unknown as StudioEnv;

		await expect(confirmStudioStream(env, user, {
			sessionId: "rawkode-live-next",
			streamToken: "stale-publisher-token",
		})).rejects.toMatchObject({
			code: "stream-active",
			status: 409,
		});
		expect(queue.send).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
		expect(studioDb.sessionRow.stream_notification_queued_at).toBeNull();
	});

	it("rejects a confirm whose CAS loses to a replacement publisher lease", async () => {
		const studioDb = createStudioDbMock({
			cloudflare_stream_live_input_id: "live-input-old",
			cloudflare_stream_playback_url: "https://stream.example/webRTC/play-old",
			content_video_id: "video-123",
			content_video_slug: "future-event",
			stream_environment: "prod",
			stream_start_token: "old-publisher-token",
			stream_status: "starting",
			title: "Future Rawkode Live episode",
		});
		const queue = { send: vi.fn(async () => undefined) };
		vi.stubGlobal("fetch", vi.fn(async () => {
			studioDb.sessionRow.cloudflare_stream_live_input_id = "live-input-replacement";
			studioDb.sessionRow.cloudflare_stream_playback_url =
				"https://stream.example/webRTC/play-replacement";
			studioDb.sessionRow.status = "live";
			studioDb.sessionRow.stream_start_token = "replacement-publisher-token";
			studioDb.sessionRow.stream_status = "live";
			return new Response(JSON.stringify({
				success: true,
				result: {
					status: "connected",
					uid: "live-input-old",
					webRTCPlayback: { url: "https://stream.example/webRTC/play-old" },
				},
			}));
		}));
		const env = {
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STREAM_NOTIFICATIONS: queue,
			STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as unknown as StudioEnv;

		await expect(confirmStudioStream(env, user, {
			sessionId: "rawkode-live-next",
			streamToken: "old-publisher-token",
		})).rejects.toMatchObject({
			code: "stream-active",
			status: 409,
		});
		expect(queue.send).not.toHaveBeenCalled();
		expect(studioDb.sessionRow.cloudflare_stream_live_input_id).toBe(
			"live-input-replacement",
		);
		expect(studioDb.sessionRow.stream_start_token).toBe(
			"replacement-publisher-token",
		);
	});

	it("accepts an idempotent confirm only for the matching publisher lease", async () => {
		const studioDb = createStudioDbMock({
			cloudflare_stream_live_input_id: "live-input-current",
			cloudflare_stream_playback_url: "https://stream.example/webRTC/play",
			content_video_id: "video-123",
			content_video_slug: "future-event",
			status: "live",
			stream_environment: "prod",
			stream_notification_queued_at: 123,
			stream_start_token: "current-publisher-token",
			stream_status: "live",
			title: "Future Rawkode Live episode",
		});
		const queue = { send: vi.fn(async () => undefined) };
		const env = {
			STREAM_NOTIFICATIONS: queue,
			STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as unknown as StudioEnv;

		await expect(confirmStudioStream(env, user, {
			sessionId: "rawkode-live-next",
			streamToken: "current-publisher-token",
		})).resolves.toEqual({
			notified: false,
			sessionId: "rawkode-live-next",
			streamStatus: "live",
		});
		expect(queue.send).not.toHaveBeenCalled();
	});

	it("retries prod stream notifications after a queue send failure", async () => {
		const studioDb = createStudioDbMock({
			content_video_id: "video-123",
			content_video_slug: "future-event",
			stream_environment: "prod",
			title: "Future Rawkode Live episode",
		});
		const queue = {
			send: vi.fn()
				.mockRejectedValueOnce(new Error("queue down"))
				.mockResolvedValueOnce(undefined),
		};
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
				new Response(
					JSON.stringify({
						success: true,
						result: {
							uid: "live-input-1",
							status: init?.method === "POST" ? "new_configuration_accepted" : "connected",
							webRTC: { url: "https://stream.example/webRTC/publish" },
							webRTCPlayback: { url: "https://stream.example/webRTC/play" },
						},
					}),
				),
			),
		);
		const env = {
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STREAM_NOTIFICATIONS: queue,
			STUDIO_DB: studioDb.db,
		STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as unknown as StudioEnv;

		const start = await startStudioStream(env, user, {
			sessionId: "rawkode-live-next",
		});
		await expect(
			confirmStudioStream(env, user, {
				sessionId: "rawkode-live-next",
				streamToken: start.streamToken,
			}),
		).resolves.toMatchObject({ notified: false, streamStatus: "live" });
		await expect(getStudioSession(env, "rawkode-live-next")).resolves.toMatchObject({
			streamNotificationQueuedAt: null,
			streamStatus: "live",
		});
		await expect(confirmStudioStream(env, user, {
			sessionId: "rawkode-live-next",
			streamToken: "stale-publisher-token",
		})).rejects.toMatchObject({ code: "stream-active", status: 409 });
		expect(queue.send).toHaveBeenCalledTimes(1);
		await expect(confirmStudioStream(env, user, {
			sessionId: "rawkode-live-next",
			streamToken: start.streamToken,
		}))
			.resolves.toMatchObject({
				notified: true,
				streamStatus: "live",
			});

		expect(queue.send).toHaveBeenCalledTimes(2);
	});

	it("rejects a stale Stream confirm after the stream has stopped", async () => {
		const studioDb = createStudioDbMock({
			content_video_id: "video-123",
			content_video_slug: "future-event",
			stream_environment: "prod",
			title: "Future Rawkode Live episode",
		});
		const queue = { send: vi.fn(async () => undefined) };
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
				new Response(
					JSON.stringify({
						success: true,
						result: {
							uid: "live-input-1",
							status: init?.method === "POST" ? "new_configuration_accepted" : "connected",
							webRTC: { url: "https://stream.example/webRTC/publish" },
							webRTCPlayback: { url: "https://stream.example/webRTC/play" },
						},
					}),
				),
			),
		);
		const env = {
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STREAM_NOTIFICATIONS: queue,
			STUDIO_DB: studioDb.db,
		STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as unknown as StudioEnv;

		const start = await startStudioStream(env, user, {
			sessionId: "rawkode-live-next",
		});
		await stopStudioStream(env, user, {
			sessionId: "rawkode-live-next",
			streamToken: start.streamToken,
		});
		await expect(
			confirmStudioStream(env, user, {
				sessionId: "rawkode-live-next",
				streamToken: start.streamToken,
			}),
		).rejects.toMatchObject({
			code: "bad-request",
			status: 409,
		});

		expect(queue.send).not.toHaveBeenCalled();
		await expect(getPublicStudioLiveState(env, "future-event")).resolves.toMatchObject({
			live: false,
		});
	});

	it("claims prod stream notifications atomically across concurrent confirms", async () => {
		const studioDb = createStudioDbMock({
			content_video_id: "video-123",
			content_video_slug: "future-event",
			stream_environment: "prod",
			title: "Future Rawkode Live episode",
		});
		const queue = { send: vi.fn(async () => undefined) };
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
				new Response(
					JSON.stringify({
						success: true,
						result: {
							uid: "live-input-1",
							status: init?.method === "POST" ? "new_configuration_accepted" : "connected",
							webRTC: { url: "https://stream.example/webRTC/publish" },
							webRTCPlayback: { url: "https://stream.example/webRTC/play" },
						},
					}),
				),
			),
		);
		const env = {
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STREAM_NOTIFICATIONS: queue,
			STUDIO_DB: studioDb.db,
		STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as unknown as StudioEnv;

		const start = await startStudioStream(env, user, {
			sessionId: "rawkode-live-next",
		});
		const results = await Promise.all([
			confirmStudioStream(env, user, {
				sessionId: "rawkode-live-next",
				streamToken: start.streamToken,
			}),
			confirmStudioStream(env, user, {
				sessionId: "rawkode-live-next",
				streamToken: start.streamToken,
			}),
		]);

		expect(results.filter((result) => result.notified)).toHaveLength(1);
		expect(queue.send).toHaveBeenCalledTimes(1);
	});

	it("resets the public stream start timestamp for a restarted session", async () => {
		const studioDb = createStudioDbMock({
			content_video_id: "video-123",
			content_video_slug: "future-event",
			cloudflare_stream_live_input_id: "live-input-1",
			stream_environment: "prod",
			stream_started_at: 123,
			stream_status: "ended",
		});
		const queue = { send: vi.fn(async () => undefined) };
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				new Response(
					JSON.stringify({
						success: true,
						result: {
							uid: "live-input-1",
							status: "connected",
							webRTC: { url: "https://stream.example/webRTC/publish" },
							webRTCPlayback: { url: "https://stream.example/webRTC/play" },
						},
					}),
				),
			),
		);
		const env = {
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STREAM_NOTIFICATIONS: queue,
			STUDIO_DB: studioDb.db,
		STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as unknown as StudioEnv;

		const start = await startStudioStream(env, user, {
			sessionId: "rawkode-live-next",
		});
		await confirmStudioStream(env, user, {
			sessionId: "rawkode-live-next",
			streamToken: start.streamToken,
		});

		const liveState = await getPublicStudioLiveState(env, "future-event");
		expect(liveState.live).toBe(true);
		expect(typeof liveState.session?.startedAt).toBe("number");
		expect(liveState.session?.startedAt).not.toBe(123);
	});

	it("rejects guest users for Stream start, confirm, and stop operations", async () => {
		const studioDb = createStudioDbMock({
			cloudflare_stream_live_input_id: "live-input-1",
			content_video_id: "video-123",
			content_video_slug: "future-event",
		});
		const env = {
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STUDIO_DB: studioDb.db,
		STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as StudioEnv;

		await expect(startStudioStream(env, guestUser, { sessionId: "rawkode-live-next" }))
			.rejects.toMatchObject({ code: "unauthorized", status: 403 });
		await expect(confirmStudioStream(env, guestUser, { sessionId: "rawkode-live-next" }))
			.rejects.toMatchObject({ code: "unauthorized", status: 403 });
		await expect(stopStudioStream(env, guestUser, { sessionId: "rawkode-live-next" }))
			.rejects.toMatchObject({ code: "unauthorized", status: 403 });
	});

	it("marks fallback recordings ready without storage bindings in local mode", async () => {
		const result = await markStudioRecordingReady(
			{ STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode" } as StudioEnv,
			user,
			{
				recordingId: "recording-1",
				sessionId: "rawkode-live-next",
				sourceBucket: "rawkode-recordings",
				sourceEtag: "abc123",
				sourceFormat: "mkv",
				sourceKey: "studio/recordings/rawkode-live-next/recording-1/source.mkv",
				videoId: "rawkode-live/example",
			},
		);

		expect(result.readyMarkerKey).toBe(
			"studio/recordings/rawkode-live-next/recording-1/ready.json",
		);
		expect(result.videoId).toBe("studio-rehearsal-rawkode-live-next");
		expect(result.outputPrefix).toBe(
			"videos/studio-rehearsal-rawkode-live-next/",
		);
		expect(result.sourceVerified).toBe(false);
	});

	it("targets content video IDs when publishing recording markers", async () => {
		const writes: Array<{ key: string; value: string }> = [];
		const studioDb = createStudioDbMock({
			content_video_id: "video-123",
			stream_environment: "prod",
		});
		const recordings = {
			head: async () => ({ etag: '"abc123"' }),
			put: async (key: string, value: string) => {
				writes.push({ key, value });
				return null;
			},
		} as unknown as R2Bucket;

		const result = await markStudioRecordingReady(
			{
				RECORDINGS: recordings,
				RECORDINGS_BUCKET_NAME: "verified-recordings",
				STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv,
			user,
			{
				recordingId: "recording-1",
				sessionId: "rawkode-live-next",
				sourceEtag: "abc123",
				sourceFormat: "webm",
				sourceKey: "studio/recordings/rawkode-live-next/recording-1/source.webm",
			},
		);

		expect(result.videoId).toBe("video-123");
		expect(result.outputPrefix).toBe("videos/video-123/");
		expect(JSON.parse(writes[0]?.value ?? "{}")).toMatchObject({
			outputPrefix: "videos/video-123/",
			videoId: "video-123",
		});
	});

	it("rejects persistent recording handoff without a content video ID", async () => {
		const studioDb = createStudioDbMock({ stream_environment: "prod" });
		let touchedRecordings = false;
		const recordings = {
			head: async () => {
				touchedRecordings = true;
				return { etag: '"abc123"' };
			},
			put: async () => {
				touchedRecordings = true;
				return null;
			},
		} as unknown as R2Bucket;

		await expect(
			markStudioRecordingReady(
				{
					RECORDINGS: recordings,
					RECORDINGS_BUCKET_NAME: "verified-recordings",
					STUDIO_DB: studioDb.db,
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
				} as StudioEnv,
				user,
				{
					recordingId: "recording-1",
					sessionId: "rawkode-live-next",
					sourceEtag: "abc123",
					sourceFormat: "mkv",
					sourceKey: "studio/recordings/rawkode-live-next/recording-1/source.mkv",
				},
			),
		).rejects.toMatchObject({
			code: "bad-request",
			status: 400,
		});
		expect(touchedRecordings).toBe(false);
	});

	it("fails persistent recording handoff when R2 is not bound", async () => {
		const studioDb = createStudioDbMock();

		await expect(
			markStudioRecordingReady(
				{
					STUDIO_DB: studioDb.db,
					STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
				} as StudioEnv,
				user,
				{
					recordingId: "recording-1",
					sessionId: "rawkode-live-next",
					sourceBucket: "rawkode-recordings",
					sourceEtag: "abc123",
					sourceFormat: "mkv",
					sourceKey: "studio/recordings/rawkode-live-next/recording-1/source.mkv",
					videoId: "rawkode-live/example",
				},
			),
		).rejects.toMatchObject({
			code: "storage-not-configured",
			status: 503,
		});
	});

	it("requires manager access for recording handoff", async () => {
		await expect(
			markStudioRecordingReady({} as StudioEnv, guestUser, {
				recordingId: "recording-1",
				sessionId: "rawkode-live-next",
				sourceBucket: "rawkode-recordings",
				sourceEtag: "abc123",
				sourceFormat: "mkv",
				sourceKey: "studio/recordings/rawkode-live-next/recording-1/source.mkv",
				videoId: "rawkode-live/example",
			}),
		).rejects.toMatchObject({
			code: "unauthorized",
			status: 403,
		});
	});

	it("rejects recording sources outside the session prefix", async () => {
		await expect(
			markStudioRecordingReady({
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv, user, {
				recordingId: "recording-1",
				sessionId: "rawkode-live-next",
				sourceBucket: "rawkode-recordings",
				sourceEtag: "abc123",
				sourceFormat: "mkv",
				sourceKey: "other/recording-1/source.mkv",
				videoId: "rawkode-live/example",
			}),
		).rejects.toMatchObject({
			code: "bad-request",
			status: 400,
		});
	});

	it("rejects unsafe recording IDs before creating ready marker keys", async () => {
		await expect(
			markStudioRecordingReady({
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv, user, {
				recordingId: "../recording-1",
				sessionId: "rawkode-live-next",
				sourceBucket: "rawkode-recordings",
				sourceEtag: "abc123",
				sourceFormat: "mkv",
				sourceKey: "studio/recordings/rawkode-live-next/recording-1/source.mkv",
			}),
		).rejects.toMatchObject({
			code: "bad-request",
			status: 400,
		});
	});

	it("uses the bound R2 bucket name for verified recording markers", async () => {
		const writes: Array<{ key: string; value: string }> = [];
		const studioDb = createStudioDbMock({
			content_video_id: "video-123",
			stream_environment: "prod",
		});
		const recordings = {
			head: async () => ({ etag: '"abc123"' }),
			put: async (key: string, value: string) => {
				writes.push({ key, value });
				return null;
			},
		} as unknown as R2Bucket;

		const result = await markStudioRecordingReady(
			{
				RECORDINGS: recordings,
				RECORDINGS_BUCKET_NAME: "verified-recordings",
				STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv,
			user,
			{
				recordingId: "recording-1",
				sessionId: "rawkode-live-next",
				sourceBucket: "caller-controlled",
				sourceEtag: "abc123",
				sourceFormat: "mkv",
				sourceKey: "studio/recordings/rawkode-live-next/recording-1/source.mkv",
				videoId: "caller-controlled/output",
			},
		);

		expect(result.sourceBucket).toBe("verified-recordings");
		expect(result.videoId).toBe("video-123");
		expect(JSON.parse(writes[0]?.value ?? "{}")).toMatchObject({
			sourceBucket: "verified-recordings",
			videoId: "video-123",
		});
		expect(studioDb.writes.some((write) => write.sql.includes("studio_recordings"))).toBe(
			true,
		);
	});

	it("requires D1 before writing R2 recording ready markers", async () => {
		const recordings = {
			head: async () => ({ etag: '"abc123"' }),
			put: async () => {
				throw new Error("should not write marker without D1");
			},
		} as unknown as R2Bucket;

		await expect(
			markStudioRecordingReady(
				{
					RECORDINGS: recordings,
					RECORDINGS_BUCKET_NAME: "verified-recordings",
					STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
				} as StudioEnv,
				user,
				{
					recordingId: "recording-1",
					sessionId: "rawkode-live-next",
					sourceEtag: "abc123",
					sourceFormat: "mkv",
					sourceKey: "studio/recordings/rawkode-live-next/recording-1/source.mkv",
				},
			),
		).rejects.toMatchObject({
			code: "storage-not-configured",
			status: 503,
		});
	});

	it("namespaces content-backed Test multipart uploads as rehearsals", async () => {
		const studioDb = createStudioDbMock({
			content_video_id: "video-123",
		});
		let createdKey = "";
		let contentType = "";
		let customMetadata: R2MultipartOptions["customMetadata"] = {};
		const recordings = {
			createMultipartUpload: async (
				key: string,
			options?: R2MultipartOptions,
			) => {
				createdKey = key;
				contentType = (options?.httpMetadata as R2HTTPMetadata)?.contentType ?? "";
				customMetadata = options?.customMetadata ?? {};
				return {
					key,
					uploadId: "upload-1",
				};
			},
		} as unknown as R2Bucket;

		const result = await createStudioRecordingUpload(
			{
				RECORDINGS: recordings,
				RECORDINGS_BUCKET_NAME: "verified-recordings",
				STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv,
			user,
			{
				sessionId: "rawkode-live-next",
				sourceFormat: "webm",
			},
		);

		expect(result.recordingId).toMatch(/^recording-/);
		expect(result.partSizeBytes).toBe(8 * 1024 * 1024);
		expect(result.sourceKey).toBe(createdKey);
		expect(result.sourceKey).toMatch(
			/^studio\/recordings\/rawkode-live-next\/recording-.+\/source\.webm$/,
		);
		expect(contentType).toBe("video/webm");
		expect(customMetadata).toMatchObject({
			recordingId: result.recordingId,
			sessionId: "rawkode-live-next",
			videoId: "studio-rehearsal-rawkode-live-next",
		});
		expect(result).toMatchObject({
			isRehearsal: true,
			outputPrefix: "videos/studio-rehearsal-rawkode-live-next/",
			videoId: "studio-rehearsal-rawkode-live-next",
		});
		expect(
			studioDb.writes.find((write) => write.sql.includes("UPDATE studio_sessions"))
				?.params,
		).toEqual(["recording", "rawkode-live-next"]);
		await expect(
			loadStudioDashboard(user, {
				STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv),
		).resolves.toMatchObject({
			sessions: [
				{
					id: "rawkode-live-next",
					recordingStatus: "recording",
				},
			],
		});
	});

	it("rejects persistent recording uploads without a content video ID", async () => {
		const studioDb = createStudioDbMock({ stream_environment: "prod" });
		const recordings = {
			createMultipartUpload: async () => {
				throw new Error("should not create upload");
			},
		} as unknown as R2Bucket;

		await expect(
			createStudioRecordingUpload(
				{
					RECORDINGS: recordings,
					RECORDINGS_BUCKET_NAME: "verified-recordings",
					STUDIO_DB: studioDb.db,
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
				} as StudioEnv,
				user,
				{
					sessionId: "rawkode-live-next",
					sourceFormat: "webm",
				},
			),
		).rejects.toMatchObject({
			code: "bad-request",
			status: 400,
		});
	});

	it("rejects non-managers before creating multipart recording uploads", async () => {
		const studioDb = createStudioDbMock();
		const recordings = {
			createMultipartUpload: async () => {
				throw new Error("should not create upload");
			},
		} as unknown as R2Bucket;

		await expect(
			createStudioRecordingUpload(
				{
					RECORDINGS: recordings,
					RECORDINGS_BUCKET_NAME: "verified-recordings",
					STUDIO_DB: studioDb.db,
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
				} as StudioEnv,
				guestUser,
				{
					sessionId: "rawkode-live-next",
					sourceFormat: "webm",
				},
			),
		).rejects.toMatchObject({
			code: "unauthorized",
			status: 403,
		});
	});

	it("uploads recording parts through server-owned multipart source keys", async () => {
		const studioDb = createStudioDbMock({
			content_video_id: "video-123",
			stream_environment: "prod",
		});
		let resumedKey = "";
		let resumedUploadId = "";
		let uploadedPartSize = 0;
		const recordings = {
			resumeMultipartUpload: (key: string, uploadId: string) => {
				resumedKey = key;
				resumedUploadId = uploadId;
				return {
					uploadPart: async (partNumber: number, body: ReadableStream) => {
						uploadedPartSize = (await new Response(body).arrayBuffer()).byteLength;
						return { etag: "part-etag", partNumber };
					},
				};
			},
		} as unknown as R2Bucket;

		const result = await uploadStudioRecordingPart(
			{
				RECORDINGS: recordings,
				RECORDINGS_BUCKET_NAME: "verified-recordings",
				STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv,
			user,
			{
				body: new Blob(["recording-part"]).stream(),
				partNumber: 3,
				recordingId: "recording-1",
				sessionId: "rawkode-live-next",
				sourceFormat: "webm",
				uploadId: "upload-1",
			},
		);

		expect(resumedKey).toBe(
			"studio/recordings/rawkode-live-next/recording-1/source.webm",
		);
		expect(resumedUploadId).toBe("upload-1");
		expect(uploadedPartSize).toBe("recording-part".length);
		expect(result).toEqual({ etag: "part-etag", partNumber: 3 });
	});

	it("returns sessions to idle when multipart recording uploads are aborted", async () => {
		const studioDb = createStudioDbMock({
			recording_status: "recording",
		});
		let abortedKey = "";
		let abortedUploadId = "";
		const recordings = {
			resumeMultipartUpload: (key: string, uploadId: string) => {
				abortedKey = key;
				abortedUploadId = uploadId;
				return {
					abort: async () => undefined,
				};
			},
		} as unknown as R2Bucket;

		const result = await abortStudioRecordingUpload(
			{
				RECORDINGS: recordings,
				RECORDINGS_BUCKET_NAME: "verified-recordings",
				STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv,
			user,
			{
				recordingId: "recording-1",
				sessionId: "rawkode-live-next",
				sourceFormat: "webm",
				uploadId: "upload-1",
			},
		);

		expect(abortedKey).toBe(
			"studio/recordings/rawkode-live-next/recording-1/source.webm",
		);
		expect(abortedUploadId).toBe("upload-1");
		expect(result).toEqual({
			aborted: true,
			recordingId: "recording-1",
			sessionId: "rawkode-live-next",
			sourceKey: "studio/recordings/rawkode-live-next/recording-1/source.webm",
		});
		expect(
			studioDb.writes.find((write) => write.sql.includes("UPDATE studio_sessions"))
				?.params,
		).toEqual(["idle", "rawkode-live-next"]);
		await expect(loadStudioDashboard(user, {
			STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as StudioEnv))
			.resolves.toMatchObject({
				sessions: [
					{
						id: "rawkode-live-next",
						recordingStatus: "idle",
					},
				],
			});
	});

	it("completes multipart uploads and publishes the recording ready marker", async () => {
		const writes: Array<{ key: string; value: string }> = [];
		const studioDb = createStudioDbMock({
			content_video_id: "video-123",
			stream_environment: "prod",
		});
		let completedParts: R2UploadedPart[] = [];
		const recordings = {
			head: async (key: string) =>
				key === "studio/recordings/rawkode-live-next/recording-1/source.webm"
					? ({ etag: "complete-etag" } as R2Object)
					: null,
			put: async (key: string, value: string) => {
				writes.push({ key, value });
				return null;
			},
			resumeMultipartUpload: (key: string, uploadId: string) => ({
				complete: async (parts: R2UploadedPart[]) => {
					completedParts = parts;
					expect(key).toBe(
						"studio/recordings/rawkode-live-next/recording-1/source.webm",
					);
					expect(uploadId).toBe("upload-1");
					return {
						etag: "complete-etag",
						key,
					} as R2Object;
				},
			}),
		} as unknown as R2Bucket;

		const result = await completeStudioRecordingUpload(
			{
				RECORDINGS: recordings,
				RECORDINGS_BUCKET_NAME: "verified-recordings",
				STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv,
			user,
			{
				parts: [
					{ etag: "part-2", partNumber: 2 },
					{ etag: "part-1", partNumber: 1 },
				],
				recordingId: "recording-1",
				sessionId: "rawkode-live-next",
				sourceFormat: "webm",
				uploadId: "upload-1",
			},
		);

		expect(completedParts).toEqual([
			{ etag: "part-1", partNumber: 1 },
			{ etag: "part-2", partNumber: 2 },
		]);
		expect(result.sourceEtag).toBe("complete-etag");
		expect(result.sourceKey).toBe(
			"studio/recordings/rawkode-live-next/recording-1/source.webm",
		);
		expect(result.videoId).toBe("video-123");
		expect(JSON.parse(writes[0]?.value ?? "{}")).toMatchObject({
			sourceBucket: "verified-recordings",
			sourceEtag: "complete-etag",
			sourceFormat: "webm",
			videoId: "video-123",
		});
		expect(studioDb.writes.some((write) => write.sql.includes("studio_recordings"))).toBe(
			true,
		);
	});

	it("round-trips uploaded browser recordings into VOD-ready dashboard state", async () => {
		const studioDb = createStudioDbMock({
			content_video_id: "video-123",
		});
		const recordings = createRecordingBucketMock();
		const env = {
			RECORDINGS: recordings.bucket,
			RECORDINGS_BUCKET_NAME: "verified-recordings",
			STUDIO_DB: studioDb.db,
		STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as StudioEnv;

		const upload = await createStudioRecordingUpload(env, user, {
			sessionId: "rawkode-live-next",
			sourceFormat: "webm",
		});
		const part = await uploadStudioRecordingPart(env, user, {
			body: new Blob(["browser-recording"]).stream(),
			partNumber: 1,
			recordingId: upload.recordingId,
			sessionId: upload.sessionId,
			sourceFormat: upload.sourceFormat,
			uploadId: upload.uploadId,
		});
		const handoff = await completeStudioRecordingUpload(env, user, {
			parts: [part],
			recordingId: upload.recordingId,
			sessionId: upload.sessionId,
			sourceFormat: upload.sourceFormat,
			uploadId: upload.uploadId,
		});

		const readyMarker = JSON.parse(recordings.text(handoff.readyMarkerKey) ?? "{}");
		expect(handoff).toMatchObject({
			outputPrefix: "videos/studio-rehearsal-rawkode-live-next/",
			readyMarkerKey:
				`studio/recordings/rawkode-live-next/${upload.recordingId}/ready.json`,
			sourceBucket: "verified-recordings",
			sourceEtag: "complete-17",
			sourceFormat: "webm",
			sourceKey: upload.sourceKey,
			sourceVerified: true,
			videoId: "studio-rehearsal-rawkode-live-next",
		});
		expect(readyMarker).toMatchObject({
			contractVersion: 1,
			outputPrefix: "videos/studio-rehearsal-rawkode-live-next/",
			recordingId: upload.recordingId,
			sourceBucket: "verified-recordings",
			sourceKey: upload.sourceKey,
			studioSessionId: "rawkode-live-next",
			videoId: "studio-rehearsal-rawkode-live-next",
		});
		await expect(listStudioRecordings(env, "rawkode-live-next")).resolves.toMatchObject([
			{
				handoffStatus: "ready",
				isRehearsal: true,
				outputPrefix: "videos/studio-rehearsal-rawkode-live-next/",
				recordingId: upload.recordingId,
				status: "uploaded",
				transcode: null,
				videoId: "studio-rehearsal-rawkode-live-next",
			},
		]);
		await expect(loadStudioDashboard(user, env)).resolves.toMatchObject({
			sessions: [
				{
					id: "rawkode-live-next",
					recordingStatus: "uploaded",
				},
			],
		});

		recordings.putJson(
			"videos/studio-rehearsal-rawkode-live-next/transcode-status.json",
			{
				completedAt: "2026-08-01T11:00:00.000Z",
				status: "complete",
			},
		);

		await expect(listStudioRecordings(env, "rawkode-live-next")).resolves.toMatchObject([
			{
				recordingId: upload.recordingId,
				status: "vod-ready",
				transcode: {
					completedAt: "2026-08-01T11:00:00.000Z",
					status: "complete",
					statusKey:
						"videos/studio-rehearsal-rawkode-live-next/transcode-status.json",
					streamUrl:
						"https://content.rawkode.academy/videos/studio-rehearsal-rawkode-live-next/stream.m3u8",
				},
			},
		]);
		await expect(loadStudioDashboard(user, env)).resolves.toMatchObject({
			sessions: [
				{
					id: "rawkode-live-next",
					recordingStatus: "vod-ready",
				},
			],
		});
	});

	it("round-trips ad-hoc Test recordings through isolated multipart handoff", async () => {
		const studioDb = createStudioDbMock();
		const recordings = createRecordingBucketMock();
		const env = {
			RECORDINGS: recordings.bucket,
			RECORDINGS_BUCKET_NAME: "verified-recordings",
			STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as StudioEnv;

		const upload = await createStudioRecordingUpload(env, user, {
			sessionId: "rawkode-live-next",
			sourceFormat: "webm",
		});
		expect(upload).toMatchObject({
			isRehearsal: true,
			outputPrefix: "videos/studio-rehearsal-rawkode-live-next/",
			videoId: "studio-rehearsal-rawkode-live-next",
		});
		expect(upload.sourceKey).toBe(
			`studio/recordings/rawkode-live-next/${upload.recordingId}/source.webm`,
		);

		const part = await uploadStudioRecordingPart(env, user, {
			body: new Blob(["ad-hoc-rehearsal"]).stream(),
			partNumber: 1,
			recordingId: upload.recordingId,
			sessionId: upload.sessionId,
			sourceFormat: upload.sourceFormat,
			uploadId: upload.uploadId,
		});
		const handoff = await completeStudioRecordingUpload(env, user, {
			parts: [part],
			recordingId: upload.recordingId,
			sessionId: upload.sessionId,
			sourceFormat: upload.sourceFormat,
			uploadId: upload.uploadId,
		});
		expect(handoff).toMatchObject({
			outputPrefix: "videos/studio-rehearsal-rawkode-live-next/",
			readyMarkerKey:
				`studio/recordings/rawkode-live-next/${upload.recordingId}/ready.json`,
			sourceKey: upload.sourceKey,
			videoId: "studio-rehearsal-rawkode-live-next",
		});
		expect(JSON.parse(recordings.text(handoff.readyMarkerKey) ?? "{}")).toMatchObject({
			outputPrefix: "videos/studio-rehearsal-rawkode-live-next/",
			recordingId: upload.recordingId,
			studioSessionId: "rawkode-live-next",
			videoId: "studio-rehearsal-rawkode-live-next",
		});

		const retriedHandoff = await markStudioRecordingReady(env, user, {
			recordingId: upload.recordingId,
			sessionId: upload.sessionId,
			sourceEtag: handoff.sourceEtag,
			sourceFormat: upload.sourceFormat,
			sourceKey: upload.sourceKey,
		});
		expect(retriedHandoff).toMatchObject({
			outputPrefix: handoff.outputPrefix,
			readyMarkerKey: handoff.readyMarkerKey,
			videoId: handoff.videoId,
		});
		await expect(listStudioRecordings(env, upload.sessionId)).resolves.toHaveLength(1);
	});

	it("rejects every Prod recording handoff path without a content video ID", async () => {
		const studioDb = createStudioDbMock({ stream_environment: "prod" });
		const recordings = {
			resumeMultipartUpload: () => {
				throw new Error("Prod recording must be rejected before resuming R2");
			},
		} as unknown as R2Bucket;
		const env = {
			RECORDINGS: recordings,
			RECORDINGS_BUCKET_NAME: "verified-recordings",
			STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as StudioEnv;

		await expect(uploadStudioRecordingPart(env, user, {
			body: new Blob(["part"]).stream(),
			partNumber: 1,
			recordingId: "recording-1",
			sessionId: "rawkode-live-next",
			sourceFormat: "webm",
			uploadId: "upload-1",
		})).rejects.toMatchObject({ code: "bad-request", status: 400 });
		await expect(completeStudioRecordingUpload(env, user, {
			parts: [{ etag: "part-etag", partNumber: 1 }],
			recordingId: "recording-1",
			sessionId: "rawkode-live-next",
			sourceFormat: "webm",
			uploadId: "upload-1",
		})).rejects.toMatchObject({ code: "bad-request", status: 400 });
	});

	it("rejects unsafe session IDs before deriving rehearsal asset paths", async () => {
		const studioDb = createStudioDbMock({
			id: "../escape",
			recording_prefix: "studio/recordings/../escape/",
		});
		const recordings = {
			createMultipartUpload: () => {
				throw new Error("unsafe session must be rejected before writing R2");
			},
		} as unknown as R2Bucket;

		await expect(createStudioRecordingUpload({
			RECORDINGS: recordings,
			RECORDINGS_BUCKET_NAME: "verified-recordings",
			STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as StudioEnv, user, {
			sessionId: "../escape",
			sourceFormat: "webm",
		})).rejects.toMatchObject({ code: "bad-request", status: 400 });
	});

	it("rejects unsafe Prod content IDs before deriving output paths", async () => {
		const studioDb = createStudioDbMock({
			content_video_id: "../escape",
			stream_environment: "prod",
		});
		const recordings = {
			createMultipartUpload: () => {
				throw new Error("unsafe content ID must be rejected before writing R2");
			},
		} as unknown as R2Bucket;

		await expect(createStudioRecordingUpload({
			RECORDINGS: recordings,
			RECORDINGS_BUCKET_NAME: "verified-recordings",
			STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as StudioEnv, user, {
			sessionId: "rawkode-live-next",
			sourceFormat: "webm",
		})).rejects.toMatchObject({ code: "bad-request", status: 400 });
	});

	it("rejects unsafe recording IDs before resuming multipart uploads", async () => {
		const studioDb = createStudioDbMock();
		const recordings = {
			resumeMultipartUpload: () => {
				throw new Error("should not resume upload");
			},
		} as unknown as R2Bucket;

		await expect(
			uploadStudioRecordingPart(
				{
					RECORDINGS: recordings,
					RECORDINGS_BUCKET_NAME: "verified-recordings",
					STUDIO_DB: studioDb.db,
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
				} as StudioEnv,
				user,
				{
					body: new Blob(["recording-part"]).stream(),
					partNumber: 1,
					recordingId: "../recording-1",
					sessionId: "rawkode-live-next",
					sourceFormat: "webm",
					uploadId: "upload-1",
				},
			),
		).rejects.toMatchObject({
			code: "bad-request",
			status: 400,
		});
	});

	describe("participant invite provisioning saga", () => {
		it("serializes max-use reservations and keeps same-user retries idempotent", async () => {
			const fixture = await createGuestInviteFixture(1);
			const studioDb = createStudioDbMock({ inviteRows: [fixture.row] });
			const otherGuest = {
				...guestUser,
				id: "other-guest-subject",
				name: "Other guest",
				username: "other-guest",
			};

			const reservations = await Promise.all([
				reserveStudioInviteParticipant(
					{ STUDIO_DB: studioDb.db } as StudioEnv,
					fixture.invite,
					guestUser,
					{
						customParticipantId: "studio:guest:guest",
						imageUrl: null,
						name: "Guest",
					},
				),
				reserveStudioInviteParticipant(
					{ STUDIO_DB: studioDb.db } as StudioEnv,
					fixture.invite,
					otherGuest,
					{
						customParticipantId: "studio:guest:other-guest-subject",
						imageUrl: null,
						name: "Other guest",
					},
				),
			]);

			const winningClaim = reservations.find(
				(claim): claim is StudioInviteClaim => claim !== null,
			);
			expect(reservations.filter(Boolean)).toHaveLength(1);
			expect(winningClaim).toBeDefined();
			expect(studioDb.redemptionRows).toHaveLength(1);
			expect(studioDb.redemptionRows[0]?.state).toBe("pending");
			expect(studioDb.participantRows).toHaveLength(1);
			expect(studioDb.participantRows[0]?.provisioning_state).toBe("pending");
			expect(studioDb.inviteRows[0]?.used_count).toBe(0);

			const winningUser = winningClaim?.userId === "guest" ? guestUser : otherGuest;
			const replay = await reserveStudioInviteParticipant(
				{ STUDIO_DB: studioDb.db } as StudioEnv,
				fixture.invite,
				winningUser,
				{
					customParticipantId: winningClaim?.customParticipantId ?? "missing",
					imageUrl: null,
					name: winningUser.name ?? "Guest",
				},
			);

			expect(replay).toEqual(winningClaim);
			expect(studioDb.redemptionRows).toHaveLength(1);
			expect(studioDb.participantRows).toHaveLength(1);
			expect(studioDb.inviteRows[0]?.used_count).toBe(0);
		});

		it("finalizes from exact participant state and derives use counts without increments", async () => {
			const fixture = await createGuestInviteFixture(2);
			fixture.row.used_count = 99;
			const studioDb = createStudioDbMock({ inviteRows: [fixture.row] });
			const claim = await reserveStudioInviteParticipant(
				{ STUDIO_DB: studioDb.db } as StudioEnv,
				fixture.invite,
				guestUser,
				{
					customParticipantId: "studio:guest:opaque-guest",
					imageUrl: null,
					name: "Guest",
				},
			);
			expect(claim).not.toBeNull();

			await expect(finalizeStudioInviteParticipant(
				{ STUDIO_DB: studioDb.db } as StudioEnv,
				claim as StudioInviteClaim,
				{
					customParticipantId: "studio:guest:opaque-guest",
					participantId: "provider-participant-1",
				},
			)).resolves.toBe(true);
			await expect(finalizeStudioInviteParticipant(
				{ STUDIO_DB: studioDb.db } as StudioEnv,
				claim as StudioInviteClaim,
				{
					customParticipantId: "studio:guest:opaque-guest",
					participantId: "provider-participant-1",
				},
			)).resolves.toBe(true);

			expect(studioDb.redemptionRows).toMatchObject([{ state: "redeemed" }]);
			expect(studioDb.participantRows).toMatchObject([{
				provisioning_state: "ready",
				realtimekit_participant_id: "provider-participant-1",
			}]);
			expect(studioDb.inviteRows[0]?.used_count).toBe(1);

			const secondGuest = {
				...guestUser,
				id: "missing-row-subject",
				username: "missing-row",
			};
			const missingParticipantClaim = await reserveStudioInviteParticipant(
				{ STUDIO_DB: studioDb.db } as StudioEnv,
				fixture.invite,
				secondGuest,
				{
					customParticipantId: "studio:guest:missing-row-subject",
					imageUrl: null,
					name: "Missing row",
				},
			);
			expect(missingParticipantClaim).not.toBeNull();
			const missingParticipantIndex = studioDb.participantRows.findIndex(
				(row) => row.user_id === "missing-row",
			);
			expect(missingParticipantIndex).toBeGreaterThanOrEqual(0);
			studioDb.participantRows.splice(missingParticipantIndex, 1);

			await expect(finalizeStudioInviteParticipant(
				{ STUDIO_DB: studioDb.db } as StudioEnv,
				missingParticipantClaim as StudioInviteClaim,
				{
					customParticipantId: "studio:guest:missing-row-subject",
					participantId: "provider-participant-2",
				},
			)).resolves.toBe(false);
			expect(studioDb.redemptionRows.find((row) => row.user_id === "missing-row"))
				.toMatchObject({ state: "pending" });
			expect(studioDb.inviteRows[0]?.used_count).toBe(1);

			await expect(releaseStudioInviteParticipantClaim(
				{ STUDIO_DB: studioDb.db } as StudioEnv,
				claim as StudioInviteClaim,
			)).resolves.toBe(false);
			expect(studioDb.inviteRows[0]?.used_count).toBe(1);
		});

		it("releases a pending claim only after a definitive provider rejection and confirmed absence", async () => {
			const fixture = await createGuestInviteFixture();
			const studioDb = createStudioDbMock({
				inviteRows: [fixture.row],
				realtimekit_meeting_id: "meeting-1",
			});
			const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
				if (init?.method === "GET") {
					return new Response(JSON.stringify({ data: [], success: true }));
				}
				return new Response(JSON.stringify({
					errors: [{ code: 1001, message: "provider detail must stay private" }],
					success: false,
				}), { status: 404 });
			});
			vi.stubGlobal("fetch", fetchMock);

			const error = await issueStudioParticipantToken(
				createRealtimeKitStudioEnv(studioDb.db),
				guestUser,
				{
					inviteToken: fixture.token,
					role: "guest",
					sessionId: "rawkode-live-next",
				},
			).then(
				() => null,
				(cause: unknown) => cause,
			);
			expect(error).toMatchObject({
				code: "provider-unavailable",
				message:
					"RealtimeKit participant setup failed. RealtimeKit API returned 404: [1001].",
				status: 502,
			});
			expect((error as Error).message).not.toContain("provider detail must stay private");

			expect(studioDb.redemptionRows).toHaveLength(0);
			expect(studioDb.participantRows).toHaveLength(0);
			expect(studioDb.inviteRows[0]?.used_count).toBe(0);
			expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "GET"))
				.toHaveLength(3);
		});

		it("retains the pending claim when provider outcome is ambiguous", async () => {
			const fixture = await createGuestInviteFixture();
			const studioDb = createStudioDbMock({
				inviteRows: [fixture.row],
				realtimekit_meeting_id: "meeting-1",
			});
			const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
				init?.method === "GET"
					? new Response(JSON.stringify({ data: [], success: true }))
					: new Response(JSON.stringify({
						errors: [{ code: 2001, message: "ambiguous upstream failure" }],
						success: false,
					}), { status: 500 })
			);
			vi.stubGlobal("fetch", fetchMock);

			await expect(issueStudioParticipantToken(
				createRealtimeKitStudioEnv(studioDb.db),
				guestUser,
				{
					inviteToken: fixture.token,
					role: "guest",
					sessionId: "rawkode-live-next",
				},
			)).rejects.toMatchObject({ code: "provider-unavailable", status: 502 });

			expect(studioDb.redemptionRows).toMatchObject([{ state: "pending" }]);
			expect(studioDb.participantRows).toMatchObject([{
				provisioning_state: "pending",
				realtimekit_participant_id: null,
			}]);
			expect(studioDb.inviteRows[0]?.used_count).toBe(0);
			expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "GET"))
				.toHaveLength(2);
		});

		it("recovers provider success after a D1 finalize rollback using the legacy participant", async () => {
			const fixture = await createGuestInviteFixture();
			const studioDb = createStudioDbMock({
				failFinalizeBatches: 1,
				inviteRows: [fixture.row],
				realtimekit_meeting_id: "meeting-1",
			});
			const opaqueGuest = {
				...guestUser,
				id: "github:opaque-guest",
				username: "guest",
			};
			let refreshCount = 0;
			const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (init?.method === "GET") {
					return new Response(JSON.stringify({
						data: [{
							custom_participant_id: "studio:guest:guest",
							id: "legacy-participant",
						}],
						success: true,
					}));
				}
				expect(url).toContain("/participants/legacy-participant/token");
				refreshCount += 1;
				return new Response(JSON.stringify({
					data: { token: `refreshed-token-${refreshCount}` },
					success: true,
				}));
			});
			vi.stubGlobal("fetch", fetchMock);

			await expect(issueStudioParticipantToken(
				createRealtimeKitStudioEnv(studioDb.db),
				opaqueGuest,
				{
					inviteToken: fixture.token,
					role: "guest",
					sessionId: "rawkode-live-next",
				},
			)).rejects.toMatchObject({ code: "state-unavailable", status: 503 });
			expect(studioDb.redemptionRows).toMatchObject([{ state: "pending" }]);
			expect(studioDb.participantRows).toMatchObject([{
				provisioning_state: "pending",
				realtimekit_custom_participant_id: "studio:guest:github:opaque-guest",
				realtimekit_participant_id: null,
			}]);

			await expect(issueStudioParticipantToken(
				createRealtimeKitStudioEnv(studioDb.db),
				opaqueGuest,
				{
					inviteToken: fixture.token,
					role: "guest",
					sessionId: "rawkode-live-next",
				},
			)).resolves.toMatchObject({
				participantId: "legacy-participant",
				token: "refreshed-token-2",
			});

			expect(refreshCount).toBe(2);
			expect(studioDb.redemptionRows).toMatchObject([{ state: "redeemed" }]);
			expect(studioDb.participantRows).toMatchObject([{
				provisioning_state: "ready",
				realtimekit_custom_participant_id: "studio:guest:guest",
				realtimekit_participant_id: "legacy-participant",
			}]);
			expect(studioDb.inviteRows[0]?.used_count).toBe(1);
			expect(fetchMock.mock.calls.filter(([url, init]) =>
				String(url).endsWith("/participants") && init?.method === "POST"
			)).toHaveLength(0);
		});
	});

	it("requires a provider meeting before issuing contributor tokens", async () => {
		await expect(
			issueStudioParticipantToken({
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv, user, {
				role: "guest",
				sessionId: "rawkode-live-next",
			}),
		).rejects.toMatchObject({
			code: "provider-not-configured",
			status: 503,
		});
	});

	it("requires an invite before non-managers can request guest tokens", async () => {
		await expect(
			issueStudioParticipantToken({} as StudioEnv, guestUser, {
				role: "guest",
				sessionId: "rawkode-live-next",
			}),
		).rejects.toMatchObject({
			code: "unauthorized",
			status: 403,
		});
	});

	it("requires content-listed guests to use an invite token", async () => {
		const studioDb = createStudioDbMock({
			content_guests_json: JSON.stringify([
				{
					id: "guest",
					name: "Guest",
					githubHandle: "guest",
					avatarUrl: null,
				},
			]),
			realtimekit_meeting_id: "meeting-1",
			status: "live",
		});
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url === "https://content.example/graphql") {
				return new Response(
					JSON.stringify({
						data: {
							personByGithub: {
								id: "guest",
								name: "Content Guest",
								githubHandle: "guest",
								avatarUrl: "https://example.com/guest.png",
							},
						},
					}),
				);
			}

			expect(url).toBe(
				"https://api.cloudflare.com/client/v4/accounts/account-1/realtime/kit/app-1/meetings/meeting-1/participants",
			);
			const body = JSON.parse(String(init?.body ?? "{}")) as {
				preset_name?: string;
			};
			expect(body.preset_name).toBe("guest-preset");
			return new Response(
				JSON.stringify({
					success: true,
					result: {
						id: "participant-guest",
						token: "guest-token",
					},
				}),
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			issueStudioParticipantToken(
				{
					CLOUDFLARE_ACCOUNT_ID: "account-1",
					REALTIMEKIT_API_TOKEN: "token-1",
					REALTIMEKIT_APP_ID: "app-1",
					REALTIMEKIT_GUEST_PRESET: "guest-preset",
					RAWKODE_GRAPHQL_URL: "https://content.example/graphql",
					STUDIO_DB: studioDb.db,
					STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
				} as StudioEnv,
				guestUser,
				{
					role: "guest",
					sessionId: "rawkode-live-next",
				},
			),
		).rejects.toMatchObject({ code: "unauthorized", status: 403 });
	});

	it("rejects participant tokens for ended sessions", async () => {
		const studioDb = createStudioDbMock({
			realtimekit_meeting_id: "meeting-1",
			status: "complete",
		});

		await expect(
			issueStudioParticipantToken(
				{
					CLOUDFLARE_ACCOUNT_ID: "account-1",
					REALTIMEKIT_API_TOKEN: "token-1",
					REALTIMEKIT_APP_ID: "app-1",
					STUDIO_DB: studioDb.db,
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
				} as StudioEnv,
				user,
				{
					role: "host",
					sessionId: "rawkode-live-next",
				},
			),
		).rejects.toMatchObject({
			code: "session-ended",
			status: 409,
		});
	});

	it("lets a previously redeemed guest resolve a full single-use invite again", async () => {
		const tokenHash = await hashInviteToken("guest-invite");
		const studioDb = createStudioDbMock({
			cloudflare_stream_live_input_id: "test-live-input",
			cloudflare_stream_playback_url: "https://stream.example/webRTC/play-secret",
			inviteRows: [
				{
					token_hash: tokenHash,
					session_id: "rawkode-live-next",
					role: "guest",
					expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
					max_uses: 1,
					used_count: 1,
					created_by_id: "rawkode",
					created_by_github: "rawkode",
					created_at: 1,
					revoked_at: null,
				},
			],
			redemptionRows: [
				{
					token_hash: tokenHash,
					user_id: "guest",
				},
			],
		});

		await expect(
			resolveStudioInvite(
				{
					STUDIO_DB: studioDb.db,
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
				} as StudioEnv,
				"guest-invite",
			),
		).resolves.toBeNull();
		await expect(
			resolveStudioInvite(
				{
					STUDIO_DB: studioDb.db,
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
				} as StudioEnv,
				"guest-invite",
				guestUser,
			),
		).resolves.toMatchObject({
			invite: {
				maxUses: 1,
				usedCount: 1,
			},
			session: {
				cloudflareStreamLiveInputId: null,
				cloudflareStreamPlaybackUrl: null,
				id: "rawkode-live-next",
			},
		});
		await expect(
			resolveStudioInvite(
				{
					STUDIO_DB: studioDb.db,
				STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
				} as StudioEnv,
				"guest-invite",
				{
					...guestUser,
					id: "other-guest",
					username: "other-guest",
				},
			),
		).resolves.toBeNull();
	});

	it("creates single-use guest invites without persisting raw tokens", async () => {
		const studioDb = createStudioDbMock();

		const result = await createStudioInvite(
			{
				STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv,
			user,
			{
				expiresInHours: 12,
				maxUses: 1,
				sessionId: "rawkode-live-next",
			},
		);

		const inviteWrite = studioDb.writes.find((write) =>
			write.sql.includes("INSERT INTO studio_invites")
		);
		expect(result.inviteToken).toHaveLength(43);
		expect(result.inviteUrl).toBe(`/guest/${result.inviteToken}`);
		expect(result.invite).toMatchObject({
			maxUses: 1,
			role: "guest",
			sessionId: "rawkode-live-next",
			usedCount: 0,
		});
		expect(result.invite.expiresAt).toBeGreaterThan(
			Math.floor(Date.now() / 1000) + 11 * 60 * 60,
		);
		expect(inviteWrite?.params[0]).toHaveLength(64);
		expect(inviteWrite?.params).not.toContain(result.inviteToken);
		expect(inviteWrite?.params).toEqual([
			result.invite.tokenHash,
			"rawkode-live-next",
			"guest",
			result.invite.expiresAt,
			1,
			"rawkode",
			"rawkode",
			result.invite.createdAt,
		]);
	});

	it("enriches RealtimeKit participants from content people by GitHub handle", async () => {
		const studioDb = createStudioDbMock({
			realtimekit_meeting_id: "meeting-1",
		});
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url === "https://content.example/graphql") {
				const body = JSON.parse(String(init?.body ?? "{}")) as {
					variables?: { username?: string };
				};
				expect(body.variables?.username).toBe("rawkode");
				return new Response(
					JSON.stringify({
						data: {
							personByGithub: {
								id: "rawkode-person",
								name: "Rawkode Academy",
								githubHandle: "rawkode",
								avatarUrl: "https://example.com/rawkode.png",
							},
						},
					}),
				);
			}
			if (init?.method === "GET") {
				expect(url).toBe(
					"https://api.cloudflare.com/client/v4/accounts/account-1/realtime/kit/app-1/meetings/meeting-1/participants?page_no=1&per_page=100",
				);
				return new Response(JSON.stringify({
					data: [],
					paging: { end_offset: 0, start_offset: 0, total_count: 0 },
					success: true,
				}));
			}

			expect(url).toBe(
				"https://api.cloudflare.com/client/v4/accounts/account-1/realtime/kit/app-1/meetings/meeting-1/participants",
			);
			const body = JSON.parse(String(init?.body ?? "{}")) as {
				custom_participant_id?: string;
				name?: string;
				picture?: string;
				preset_name?: string;
				};
				expect(body).toMatchObject({
					custom_participant_id: "studio:host:github:rawkode",
					name: "Rawkode Academy",
					picture: "https://example.com/rawkode.png",
					preset_name: "host-preset",
				});
			return new Response(
				JSON.stringify({
					success: true,
					result: {
						id: "participant-1",
						token: "participant-token",
					},
				}),
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await issueStudioParticipantToken(
			{
				CLOUDFLARE_ACCOUNT_ID: "account-1",
				REALTIMEKIT_API_TOKEN: "token-1",
				REALTIMEKIT_APP_ID: "app-1",
				REALTIMEKIT_HOST_PRESET: "host-preset",
				RAWKODE_GRAPHQL_URL: "https://content.example/graphql",
				STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
			} as StudioEnv,
			{
				...user,
				id: "github:rawkode",
				image: "https://example.com/auth-rawkode.png",
				name: "Auth Rawkode",
				username: "Rawkode",
			},
			{
				role: "host",
				sessionId: "rawkode-live-next",
			},
		);

		expect(result).toMatchObject({
			meetingId: "meeting-1",
			participantId: "participant-1",
			sessionId: "rawkode-live-next",
			token: "participant-token",
		});
		expect(
			studioDb.writes.find((write) => write.sql.includes("studio_participants"))
				?.params,
		).toEqual([
			"rawkode-live-next",
			"rawkode",
			"rawkode",
			"host",
			"Rawkode Academy",
			"https://example.com/rawkode.png",
			"studio:host:github:rawkode",
			"participant-1",
			"ready",
		]);
	});

	it("ends publicly and remains retryable when Cloudflare Stream cleanup fails", async () => {
		const studioDb = createStudioDbMock({
			cloudflare_stream_live_input_id: "live-input-1",
			cloudflare_stream_playback_url: "https://stream.example/webRTC/play",
			content_video_slug: "future-event",
			realtimekit_meeting_id: "meeting-1",
			status: "live",
			stream_environment: "prod",
			stream_start_token: "publisher-token",
			stream_status: "live",
		});
		let streamAvailable = false;
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			if (String(input).includes("/stream/live_inputs/")) {
				return streamAvailable
					? new Response(JSON.stringify({
						result: { enabled: false, uid: "live-input-1" },
						success: true,
					}))
					: new Response(JSON.stringify({
						errors: [{ message: "Cloudflare Stream unavailable" }],
						success: false,
					}), { status: 503 });
			}
			return new Response(JSON.stringify({ success: true, result: {} }));
		});
		vi.stubGlobal("fetch", fetchMock);
		const env = {
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			REALTIMEKIT_API_TOKEN: "token-1",
			REALTIMEKIT_APP_ID: "app-1",
			STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as StudioEnv;

		await expect(endStudioSession(env, user, {
			sessionId: "rawkode-live-next",
		})).rejects.toMatchObject({
			code: "provider-cleanup-failed",
			status: 502,
		});
		expect(studioDb.sessionRow.status).toBe("complete");
		expect(studioDb.sessionRow.stream_status).toBe("ended");
		await expect(getPublicStudioLiveState(env, "future-event")).resolves.toEqual({
			live: false,
			playbackUrl: null,
			session: null,
		});

		streamAvailable = true;
		await expect(endStudioSession(env, user, {
			sessionId: "rawkode-live-next",
		})).resolves.toEqual({
			sessionId: "rawkode-live-next",
			status: "complete",
		});
		expect(fetchMock).toHaveBeenCalledTimes(4);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://api.cloudflare.com/client/v4/accounts/account-1/stream/live_inputs/live-input-1",
			expect.objectContaining({
				body: JSON.stringify({ enabled: false }),
				method: "PUT",
			}),
		);
	});

	it("keeps local terminal state retryable when RealtimeKit cleanup fails", async () => {
		const studioDb = createStudioDbMock({
			realtimekit_meeting_id: "meeting-1",
			status: "live",
			stream_status: "live",
		});
		let providerAvailable = false;
		vi.stubGlobal("fetch", vi.fn(async () => providerAvailable
			? new Response(JSON.stringify({ success: true, result: {} }))
			: new Response(JSON.stringify({
				errors: [{ message: "RealtimeKit unavailable" }],
				success: false,
			}), { status: 503 })));
		const env = {
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			REALTIMEKIT_API_TOKEN: "token-1",
			REALTIMEKIT_APP_ID: "app-1",
			STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as StudioEnv;

		await expect(endStudioSession(env, user, {
			sessionId: "rawkode-live-next",
		})).rejects.toMatchObject({
			code: "provider-cleanup-failed",
			status: 502,
		});
		expect(studioDb.sessionRow.status).toBe("complete");
		expect(studioDb.sessionRow.stream_status).toBe("ended");

		providerAvailable = true;
		await expect(endStudioSession(env, user, {
			sessionId: "rawkode-live-next",
		})).resolves.toEqual({
			sessionId: "rawkode-live-next",
			status: "complete",
		});
	});

	it("disables the active Cloudflare input, ends RealtimeKit, and marks D1 complete", async () => {
		const studioDb = createStudioDbMock({
			cloudflare_stream_live_input_id: "live-input-1",
			cloudflare_stream_playback_url: "https://stream.example/webRTC/play",
			realtimekit_meeting_id: "meeting-1",
			status: "live",
			stream_environment: "prod",
			stream_start_token: "publisher-token",
			stream_status: "live",
		});
		const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
			new Response(JSON.stringify({
				success: true,
				result: String(input).includes("/stream/live_inputs/")
					? { enabled: false, uid: "live-input-1" }
					: {},
			})),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			endStudioSession(
				{
					CLOUDFLARE_ACCOUNT_ID: "account-1",
					CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
					REALTIMEKIT_API_TOKEN: "token-1",
					REALTIMEKIT_APP_ID: "app-1",
					STUDIO_DB: studioDb.db,
					STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
				} as StudioEnv,
				user,
				{
					sessionId: "rawkode-live-next",
				},
			),
		).resolves.toEqual({
			sessionId: "rawkode-live-next",
			status: "complete",
		});
		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			"https://api.cloudflare.com/client/v4/accounts/account-1/stream/live_inputs/live-input-1",
			expect.objectContaining({
				body: JSON.stringify({ enabled: false }),
				method: "PUT",
			}),
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://api.cloudflare.com/client/v4/accounts/account-1/realtime/kit/app-1/meetings/meeting-1/active-session/kick-all",
			expect.objectContaining({ method: "POST" }),
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			3,
			"https://api.cloudflare.com/client/v4/accounts/account-1/realtime/kit/app-1/meetings/meeting-1",
			expect.objectContaining({
				body: JSON.stringify({ status: "INACTIVE" }),
				method: "PATCH",
			}),
		);
		expect(
			studioDb.writes.find((write) =>
				write.sql.includes("SET status = ?")
			)?.params,
		).toEqual(["complete", "rawkode-live-next"]);
		expect(studioDb.sessionRow.stream_status).toBe("ended");
		expect(studioDb.sessionRow.stream_start_token).toBeNull();
	});

	it("never disables a replacement Cloudflare input after losing the publisher lease", async () => {
		const studioDb = createStudioDbMock({
			cloudflare_stream_live_input_id: "live-input-old",
			replaceLeaseBeforeEnd: {
				liveInputId: "live-input-replacement",
				startToken: "replacement-publisher-token",
			},
			status: "live",
			stream_environment: "prod",
			stream_start_token: "old-publisher-token",
			stream_status: "live",
		});
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(endStudioSession({
			CLOUDFLARE_ACCOUNT_ID: "account-1",
			CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
			STUDIO_DB: studioDb.db,
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as StudioEnv, user, {
			sessionId: "rawkode-live-next",
		})).rejects.toMatchObject({
			code: "provider-cleanup-failed",
			status: 502,
		});
		expect(fetchMock).not.toHaveBeenCalled();
		expect(studioDb.sessionRow.status).toBe("complete");
		expect(studioDb.sessionRow.cloudflare_stream_live_input_id).toBe(
			"live-input-replacement",
		);
		expect(studioDb.sessionRow.stream_start_token).toBe(
			"replacement-publisher-token",
		);
	});

	it("hashes invite tokens instead of storing raw bearer tokens", async () => {
		await expect(hashInviteToken("invite-token")).resolves.toHaveLength(64);
	});

	it("treats Studio sessions as manageable only by configured operators", async () => {
		const session = buildStudioSession({
			createdBy: user,
			meeting: null,
			sessionId: "rawkode-live-next",
			show: "Rawkode Live",
			title: "Rawkode Live production room",
		});

		await expect(userCanManageStudioSession({} as StudioEnv, session, user)).resolves.toBe(false);
		await expect(userCanManageStudioSession({
			STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		} as StudioEnv, session, user)).resolves.toBe(true);
		await expect(
			userCanManageStudioSession({} as StudioEnv, session, guestUser),
		).resolves.toBe(false);
	});
});
