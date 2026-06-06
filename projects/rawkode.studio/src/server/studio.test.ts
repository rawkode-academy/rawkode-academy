import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioEnv } from "../env";
import {
	abortStudioRecordingUpload,
	completeStudioRecordingUpload,
	createStudioInvite,
	createStudioRecordingUpload,
	createStudioSession,
	issueStudioParticipantToken,
	markStudioRecordingReady,
	uploadStudioRecordingPart,
} from "./operations";
import {
	buildStudioSession,
	createReadyMarker,
	createReadyMarkerKey,
	getStudioSessionWatchUrl,
	hashInviteToken,
	listStudioRecordings,
	loadStudioDashboard,
	resolveStudioInvite,
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

type StudioDbMockOptions = Partial<{
	content_guests_json: string;
	content_hosts_json: string;
	content_video_id: string | null;
	content_video_slug: string | null;
	realtimekit_meeting_id: string | null;
	recording_status: "failed" | "idle" | "recording" | "transcoding" | "uploaded" | "vod-ready";
	show_id: string;
	show_title: string;
	title: string;
}> & {
	inviteRows?: StudioInviteDbRow[];
	recordingRows?: StudioRecordingDbRow[];
	redemptionRows?: Array<{ token_hash: string; user_id: string }>;
};

function createStudioDbMock(options: StudioDbMockOptions = {}) {
	const {
		inviteRows = [],
		recordingRows = [],
		redemptionRows = [],
		...overrides
	} = options;
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
		created_by_id: "rawkode",
		created_by_github: "rawkode",
		created_at: 1,
		updated_at: 1,
		...overrides,
	};
	const db = {
		prepare: (sql: string) => ({
			bind: (...params: unknown[]) => ({
				all: async () => ({
					results: sql.includes("FROM studio_recordings")
						? recordingRows.filter((row) => row.session_id === params[0])
						: sql.includes("FROM studio_sessions")
							? [sessionRow]
							: [],
				}),
				first: async () => {
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
					return sql.includes("FROM studio_sessions") ? sessionRow : null;
				},
				run: async () => {
					writes.push({ sql, params });
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
						sessionRow.recording_status = sql.includes("recording_status = ?")
							? params[0] as NonNullable<StudioDbMockOptions["recording_status"]>
							: "uploaded";
						sessionRow.updated_at = Math.floor(Date.now() / 1000);
					}
					return { meta: { changes: 1, rows_written: 1 } };
				},
			}),
		}),
	} as unknown as D1Database;

	return { db, writes };
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
	});

	it("builds Rawkode watch URLs for content-backed sessions", () => {
		const session = buildStudioSession({
			contentVideoId: "video-123",
			contentVideoSlug: "future-episode",
			createdBy: user,
			meeting: null,
			sessionId: "video-123-next",
			show: "Rawkode Live",
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
			r2_buckets?: Array<Record<string, string>>;
			routes?: Array<Record<string, string | boolean>>;
			vars?: Record<string, string>;
		};
		const envCue = readFileSync(
			new URL("../../env.cue", import.meta.url),
			"utf8",
		);
		const packageJson = JSON.parse(
			readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
		) as {
			scripts?: Record<string, string>;
		};

		expect(wrangler.name).toBe("rawkode-academy-studio");
		expect(wrangler.routes).toContainEqual({
			pattern: "studio.rawkode.academy",
			custom_domain: true,
		});
		expect(wrangler.kv_namespaces).toContainEqual(
			expect.objectContaining({ binding: "SESSION" }),
		);
		expect(wrangler.d1_databases).toContainEqual(
			expect.objectContaining({
				binding: "STUDIO_DB",
				database_name: "rawkode-academy-studio",
				migrations_dir: "./data-model",
			}),
		);
		expect(wrangler.r2_buckets).toContainEqual({
			binding: "RECORDINGS",
			bucket_name: "rawkode-academy-content",
		});
		expect(wrangler.vars).toMatchObject({
			RAWKODE_GRAPHQL_URL: "https://api.rawkode.academy/",
			RECORDINGS_BUCKET_NAME: "rawkode-academy-content",
		});
		expect(packageJson.scripts).toMatchObject({
			deploy: "bun x wrangler deploy",
			migrate: "bun x wrangler d1 migrations apply rawkode-academy-studio --remote",
		});
		expect(envCue).toContain("CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef");
		expect(envCue).toContain("op://sa.rawkode.academy/cloudflare/api-tokens/workers");
		expect(envCue).toContain("tasks: [_t.migrations.remote, _t.check, _t.test, _t.deploy.main]");
		expect(envCue).toContain('args: ["run", "migrate"]');
	});

	it("initializes the RealtimeKit room bridge with media defaults and compatible join APIs", () => {
		const roomBridge = readFileSync(
			new URL("../components/RealtimeKitRoom.vue", import.meta.url),
			"utf8",
		);

		expect(roomBridge).toContain("defaults: { audio: true, video: true }");
		expect(roomBridge).toContain("const join = nextMeeting.joinRoom ?? nextMeeting.join");
		expect(roomBridge).toContain("await join.call(nextMeeting)");
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

		expect(migration).toContain("ADD COLUMN content_video_id TEXT");
		expect(migration).toContain(
			"ADD COLUMN content_hosts_json TEXT NOT NULL DEFAULT '[]'",
		);
		expect(migration).toContain(
			"ADD COLUMN content_guests_json TEXT NOT NULL DEFAULT '[]'",
		);
		expect(slugMigration).toContain("ADD COLUMN content_video_slug TEXT");
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

	it("keeps the demo guest invite available when local D1 is bound", async () => {
		const prepare = vi.fn();

		const resolved = await resolveStudioInvite(
			{
				STUDIO_DB: { prepare } as unknown as D1Database,
			} as StudioEnv,
			"demo",
			guestUser,
		);

		expect(resolved?.invite.tokenHash).toBe("demo");
		expect(resolved?.session.id).toBe("rawkode-live-next");
		expect(prepare).not.toHaveBeenCalled();
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
	});

	it("does not expose Studio sessions on anonymous dashboards", async () => {
		await expect(loadStudioDashboard(undefined, {} as StudioEnv)).resolves.toMatchObject({
			sessions: [],
			user: null,
		});
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

	it("creates Studio sessions from content graph video metadata", async () => {
		const studioDb = createStudioDbMock();
		const fetchMock = vi.fn(async () =>
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
		expect(getStudioSessionWatchUrl(result.session)).toBe(
			"https://rawkode.academy/watch/future-episode",
		);
	});

	it("marks fallback recordings ready without storage bindings in local mode", async () => {
		const result = await markStudioRecordingReady(
			{} as StudioEnv,
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
		expect(result.videoId).toBe("rawkode-live/rawkode-live-next");
		expect(result.outputPrefix).toBe("videos/rawkode-live/rawkode-live-next/");
		expect(result.sourceVerified).toBe(false);
	});

	it("targets content video IDs when publishing recording markers", async () => {
		const writes: Array<{ key: string; value: string }> = [];
		const studioDb = createStudioDbMock({
			content_video_id: "video-123",
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
		const studioDb = createStudioDbMock();
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
				{ STUDIO_DB: studioDb.db } as StudioEnv,
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
			markStudioRecordingReady({} as StudioEnv, user, {
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
			markStudioRecordingReady({} as StudioEnv, user, {
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

	it("creates manager-owned multipart recording uploads under the session prefix", async () => {
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
			videoId: "video-123",
		});
		expect(
			studioDb.writes.find((write) => write.sql.includes("UPDATE studio_sessions"))
				?.params,
		).toEqual(["recording", "rawkode-live-next"]);
		await expect(
			loadStudioDashboard(user, {
				STUDIO_DB: studioDb.db,
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
		await expect(loadStudioDashboard(user, { STUDIO_DB: studioDb.db } as StudioEnv))
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
			outputPrefix: "videos/video-123/",
			readyMarkerKey:
				`studio/recordings/rawkode-live-next/${upload.recordingId}/ready.json`,
			sourceBucket: "verified-recordings",
			sourceEtag: "complete-17",
			sourceFormat: "webm",
			sourceKey: upload.sourceKey,
			sourceVerified: true,
			videoId: "video-123",
		});
		expect(readyMarker).toMatchObject({
			contractVersion: 1,
			outputPrefix: "videos/video-123/",
			recordingId: upload.recordingId,
			sourceBucket: "verified-recordings",
			sourceKey: upload.sourceKey,
			studioSessionId: "rawkode-live-next",
			videoId: "video-123",
		});
		await expect(listStudioRecordings(env, "rawkode-live-next")).resolves.toMatchObject([
			{
				handoffStatus: "ready",
				outputPrefix: "videos/video-123/",
				recordingId: upload.recordingId,
				status: "uploaded",
				transcode: null,
				videoId: "video-123",
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
			"videos/video-123/transcode-status.json",
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
					statusKey: "videos/video-123/transcode-status.json",
					streamUrl:
						"https://content.rawkode.academy/videos/video-123/stream.m3u8",
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

	it("requires a provider meeting before issuing contributor tokens", async () => {
		await expect(
			issueStudioParticipantToken({} as StudioEnv, user, {
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

	it("lets a previously redeemed guest resolve a full single-use invite again", async () => {
		const tokenHash = await hashInviteToken("guest-invite");
		const studioDb = createStudioDbMock({
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
				} as StudioEnv,
				"guest-invite",
			),
		).resolves.toBeNull();
		await expect(
			resolveStudioInvite(
				{
					STUDIO_DB: studioDb.db,
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
				id: "rawkode-live-next",
			},
		});
		await expect(
			resolveStudioInvite(
				{
					STUDIO_DB: studioDb.db,
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
				custom_participant_id: "rawkode",
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
				CLOUDFLARE_API_TOKEN: "token-1",
				REALTIMEKIT_APP_ID: "app-1",
				REALTIMEKIT_HOST_PRESET: "host-preset",
				RAWKODE_GRAPHQL_URL: "https://content.example/graphql",
				STUDIO_DB: studioDb.db,
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
		]);
	});

	it("hashes invite tokens instead of storing raw bearer tokens", async () => {
		await expect(hashInviteToken("invite-token")).resolves.toHaveLength(64);
	});

	it("treats fallback sessions as manageable only by the owner handle", async () => {
		const session = buildStudioSession({
			createdBy: user,
			meeting: null,
			sessionId: "rawkode-live-next",
			show: "Rawkode Live",
			title: "Rawkode Live production room",
		});

		await expect(userCanManageStudioSession({} as StudioEnv, session, user)).resolves.toBe(
			true,
		);
		await expect(
			userCanManageStudioSession({} as StudioEnv, session, guestUser),
		).resolves.toBe(false);
	});
});
