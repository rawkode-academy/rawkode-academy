/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
	assertReadyMarker,
	assertReadyMarkerPathContract,
	createEventId,
	createReadyMarkerKey,
	createRecordingPrefix,
	createTranscodeStatus,
	createTranscodeStatusKey,
	isObjectCreateAction,
	isStudioReadyMarker,
	type R2EventNotification,
	type StudioRecordingReadyMarker,
} from "../src/contracts.js";
import {
	handleR2Event,
	type Env,
} from "../src/main.js";
import {
	requireCloudRunOperationName,
	type CloudRunConfig,
} from "../src/google.js";

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

describe("studio recording ingest contracts", () => {
	it("accepts only studio ready marker keys", () => {
		expect(
			isStudioReadyMarker("studio/recordings/session-1/recording-1/ready.json"),
		).toBe(true);
		expect(isStudioReadyMarker("videos/video-1/original.mkv")).toBe(false);
		expect(
			isStudioReadyMarker("studio/recordings/session-1/recording-1/source.webm"),
		).toBe(false);
	});

	it("accepts only R2 object-create actions", () => {
		expect(isObjectCreateAction("PutObject")).toBe(true);
		expect(isObjectCreateAction("CopyObject")).toBe(true);
		expect(isObjectCreateAction("CompleteMultipartUpload")).toBe(true);
		expect(isObjectCreateAction("DeleteObject")).toBe(false);
		expect(isObjectCreateAction("LifecycleDeletion")).toBe(false);
	});

	it("uses bucket, key, and etag for idempotency", () => {
		const event: R2EventNotification = {
			action: "PutObject",
			bucket: "content",
			object: {
				key: "studio/recordings/session-1/recording-1/ready.json",
				eTag: "abc123",
			},
			eventTime: "2026-06-06T00:00:00.000Z",
		};

		expect(createEventId(event)).toBe(
			"content:studio/recordings/session-1/recording-1/ready.json:abc123",
		);
	});

	it("rejects incomplete ready markers", () => {
		expect(() => assertReadyMarker({ contractVersion: 1 })).toThrow(
			"ready marker missing videoId",
		);
	});

	it("accepts the v1 recording ready marker", () => {
		expect(() =>
			assertReadyMarker({
				contractVersion: 1,
				videoId: "video-1",
				studioSessionId: "session-1",
				recordingId: "recording-1",
				sourceBucket: "content",
				sourceKey: "studio/recordings/session-1/recording-1/program.webm",
				sourceEtag: "abc123",
				sourceFormat: "webm",
				outputPrefix: "videos/video-1/",
			}),
		).not.toThrow();
	});

	it("derives recording prefixes and ready marker keys from marker IDs", () => {
		const marker = createReadyMarker();

		expect(createRecordingPrefix(marker)).toBe(
			"studio/recordings/session-1/recording-1/",
		);
		expect(createReadyMarkerKey(marker)).toBe(
			"studio/recordings/session-1/recording-1/ready.json",
		);
	});

	it("requires ready marker keys to match marker IDs", () => {
		const marker = createReadyMarker();

		expect(() =>
			assertReadyMarkerPathContract(
				marker,
				"studio/recordings/session-2/recording-1/ready.json",
			),
		).toThrow(
			"ready marker key must be studio/recordings/session-1/recording-1/ready.json for this recording",
		);
	});

	it("requires recording sources to stay inside the marker recording prefix", () => {
		const marker = {
			...createReadyMarker(),
			sourceKey: "studio/recordings/session-2/recording-1/source.webm",
		};

		expect(() =>
			assertReadyMarkerPathContract(
				marker,
				"studio/recordings/session-1/recording-1/ready.json",
			),
		).toThrow(
			"sourceKey must be under studio/recordings/session-1/recording-1/",
		);
	});

	it("rejects ready marker source keys and mismatched source formats", () => {
		const readyMarkerAsSource = {
			...createReadyMarker(),
			sourceKey: "studio/recordings/session-1/recording-1/ready.json",
		};
		const mismatchedFormat = {
			...createReadyMarker(),
			sourceFormat: "mp4" as const,
		};

		expect(() =>
			assertReadyMarkerPathContract(
				readyMarkerAsSource,
				"studio/recordings/session-1/recording-1/ready.json",
			),
		).toThrow("sourceKey must point at a recording object, not ready.json");
		expect(() =>
			assertReadyMarkerPathContract(
				mismatchedFormat,
				"studio/recordings/session-1/recording-1/ready.json",
			),
		).toThrow("sourceKey must end with .mp4");
	});

	it("requires output prefixes to target the marker video ID", () => {
		const marker = {
			...createReadyMarker(),
			outputPrefix: "videos/other-video/",
		};

		expect(() =>
			assertReadyMarkerPathContract(
				marker,
				"studio/recordings/session-1/recording-1/ready.json",
			),
		).toThrow("outputPrefix must be videos/video-1/");
	});

	it("rejects unsafe marker path fields before Cloud Run can be invoked", () => {
		const marker = {
			...createReadyMarker(),
			videoId: "../video-1",
			outputPrefix: "videos/../video-1/",
		};

		expect(() =>
			assertReadyMarkerPathContract(
				marker,
				"studio/recordings/session-1/recording-1/ready.json",
			),
		).toThrow("videoId contains unsupported path characters");
	});

	it("builds status keys under normalized VOD output prefixes", () => {
		expect(createTranscodeStatusKey("videos/video-1")).toBe(
			"videos/video-1/transcode-status.json",
		);
		expect(createTranscodeStatusKey("videos/video-1/")).toBe(
			"videos/video-1/transcode-status.json",
		);
	});

	it("builds transcode status documents from ready markers", () => {
		const marker = createReadyMarker();

		expect(
			createTranscodeStatus(marker, {
				status: "queued",
				queuedAt: "2026-06-06T10:00:00.000Z",
			}),
		).toEqual({
			status: "queued",
			videoId: "video-1",
			studioSessionId: "session-1",
			recordingId: "recording-1",
			sourceBucket: "content",
			sourceKey: "studio/recordings/session-1/recording-1/source.webm",
			sourceEtag: "abc123",
			sourceFormat: "webm",
			outputPrefix: "videos/video-1/",
			queuedAt: "2026-06-06T10:00:00.000Z",
			failedAt: undefined,
			error: undefined,
		});
	});

	it("uses Bun-managed Wrangler scripts for Cloudflare resource commands", () => {
		const wrangler = JSON.parse(
			readFileSync("wrangler.jsonc", "utf8"),
		) as {
			d1_databases?: Array<Record<string, string>>;
			secrets_store_secrets?: Array<Record<string, string>>;
		};
		const packageJson = JSON.parse(
			readFileSync("package.json", "utf8"),
		) as { scripts?: Record<string, string> };

		expect(wrangler.secrets_store_secrets).toContainEqual(
			expect.objectContaining({
				binding: "GCP_SERVICE_ACCOUNT_JSON",
				secret_name: "GCP_SERVICE_ACCOUNT_JSON",
				store_id: "492e5e40b9d64ebeac7e7a77db91ff6e",
			}),
		);
		expect(wrangler.d1_databases).toContainEqual(
			expect.objectContaining({
				binding: "DB",
				database_name: "platform-studio-recording-ingest",
				database_id: "53159084-61e6-425d-9660-8f350a08f036",
			}),
		);
		expect(packageJson.scripts).toMatchObject({
			"d1:create": "bun x wrangler d1 create platform-studio-recording-ingest",
			deploy: "bun x wrangler deploy",
			"deploy:dry-run": "bun x wrangler deploy --dry-run",
			migrate:
				"bun x wrangler d1 migrations apply platform-studio-recording-ingest --remote",
			"notify:create":
				"bun x wrangler r2 bucket notification create rawkode-academy-content --event-type object-create --queue platform-studio-recording-ingest --prefix \"studio/recordings/\" --suffix \"/ready.json\"",
			"notify:list": "bun x wrangler r2 bucket notification list rawkode-academy-content",
			"verify:live": "bun run scripts/verify-live.ts",
		});
		expect(readFileSync("scripts/verify-live.ts", "utf8")).toContain(
			"53159084-61e6-425d-9660-8f350a08f036",
		);
		expect(readFileSync("scripts/verify-live.ts", "utf8")).toContain(
			"GCP_SERVICE_ACCOUNT_JSON",
		);
		expect(readFileSync("scripts/verify-live.ts", "utf8")).toContain(
			"secrets-store",
		);
		expect(packageJson.scripts?.["notify:create"]).toContain(
			"--event-type object-create",
		);
		expect(packageJson.scripts?.["notify:create"]).toContain(
			"--prefix \"studio/recordings/\" --suffix \"/ready.json\"",
		);
		expect(packageJson.scripts?.["queues:create"]).toContain("bun x wrangler queues create");
	});

	it("requires a Cloud Run operation name before marking jobs triggered", () => {
		expect(requireCloudRunOperationName({ name: "operations/transcode-1" })).toBe(
			"operations/transcode-1",
		);
		expect(() => requireCloudRunOperationName({})).toThrow(
			"Cloud Run jobs.run returned no operation name",
		);
	});
});

describe("studio recording ingest worker", () => {
	it("writes queued transcode status before triggering Cloud Run", async () => {
		const marker = createReadyMarker();
		const event = createReadyEvent();
		const db = createDbMock();
		const recordings = createRecordingsMock(marker);
		const env = createEnv(db.db, recordings.bucket);
		const serviceAccountJson = env.GCP_SERVICE_ACCOUNT_JSON as string;
		const serviceAccountSecret = createSecretsStoreRpcBinding(serviceAccountJson);
		env.GCP_SERVICE_ACCOUNT_JSON = serviceAccountSecret.binding;
		const calls: Array<{
			config: CloudRunConfig;
			marker: StudioRecordingReadyMarker;
		}> = [];

		const result = await handleR2Event(
			env,
			event,
			{
				runTranscodingJob: async (config, receivedMarker) => {
					calls.push({ config, marker: receivedMarker });
					return "operations/transcode-1";
				},
			},
		);

		expect(result).toEqual({
			eventId: "content:studio/recordings/session-1/recording-1/ready.json:abc123",
			cloudRunExecution: "operations/transcode-1",
		});
		expect(calls[0]?.config.serviceAccount).toMatchObject({
			client_email: "studio-recording-ingest@example.iam.gserviceaccount.com",
		});
		expect(serviceAccountSecret.get).toHaveBeenCalledOnce();
		expect(calls).toEqual([
			{
				config: expect.objectContaining({
					jobName: "transcoding-job",
					location: "europe-west2",
					projectId: "rawkode-academy-production",
				}),
				marker,
			},
		]);
		expect(recordings.writes).toHaveLength(1);
		expect(recordings.writes[0]).toMatchObject({
			key: "videos/video-1/transcode-status.json",
			contentType: "application/json",
		});
		expect(JSON.parse(recordings.writes[0]?.value ?? "{}")).toMatchObject({
			status: "queued",
			videoId: "video-1",
			studioSessionId: "session-1",
			recordingId: "recording-1",
			sourceBucket: "content",
			sourceKey: "studio/recordings/session-1/recording-1/source.webm",
			sourceEtag: "abc123",
			sourceFormat: "webm",
			outputPrefix: "videos/video-1/",
			queuedAt: expect.any(String),
		});
		expect(db.writes.map((write) => write.params[0])).toEqual([
			"content:studio/recordings/session-1/recording-1/ready.json:abc123",
			"validated",
			"triggered",
		]);
	});

	it("marks transcode status as failed when Cloud Run cannot be triggered", async () => {
		const marker = createReadyMarker();
		const db = createDbMock();
		const recordings = createRecordingsMock(marker);

		await expect(
			handleR2Event(
				createEnv(db.db, recordings.bucket),
				createReadyEvent(),
				{
					runTranscodingJob: async () => {
						throw new Error("Cloud Run unavailable");
					},
				},
			),
		).rejects.toThrow("Cloud Run unavailable");

		expect(recordings.writes).toHaveLength(2);
		expect(recordings.writes[1]).toMatchObject({
			key: "videos/video-1/transcode-status.json",
			contentType: "application/json",
		});
		expect(JSON.parse(recordings.writes[1]?.value ?? "{}")).toMatchObject({
			status: "failed",
			error: "Cloud Run unavailable",
			failedAt: expect.any(String),
		});
		expect(db.writes.at(-1)?.params).toEqual([
			"failed",
			null,
			"Cloud Run unavailable",
			null,
			null,
			null,
			"content:studio/recordings/session-1/recording-1/ready.json:abc123",
		]);
	});

	it("does not rewrite status or run Cloud Run for duplicate events", async () => {
		const marker = createReadyMarker();
		const event = createReadyEvent();
		const db = createDbMock();
		const recordings = createRecordingsMock(marker);
		const env = createEnv(db.db, recordings.bucket);
		let runCount = 0;
		const runTranscodingJob = async () => {
			runCount += 1;
			return "operations/transcode-1";
		};

		await handleR2Event(env, event, { runTranscodingJob });
		recordings.writes.length = 0;

		await expect(
			handleR2Event(env, event, { runTranscodingJob }),
		).resolves.toEqual({
			duplicate: true,
			eventId: "content:studio/recordings/session-1/recording-1/ready.json:abc123",
			status: "triggered",
		});
		expect(runCount).toBe(1);
		expect(recordings.writes).toHaveLength(0);
	});

	it("retries failed events instead of treating them as terminal duplicates", async () => {
		const marker = createReadyMarker();
		const event = createReadyEvent();
		const db = createDbMock();
		const recordings = createRecordingsMock(marker);
		const env = createEnv(db.db, recordings.bucket);
		let runCount = 0;

		await expect(
			handleR2Event(env, event, {
				runTranscodingJob: async () => {
					runCount += 1;
					throw new Error("temporary Cloud Run outage");
				},
			}),
		).rejects.toThrow("temporary Cloud Run outage");

		recordings.writes.length = 0;
		await expect(
			handleR2Event(env, event, {
				runTranscodingJob: async () => {
					runCount += 1;
					return "operations/transcode-retry";
				},
			}),
		).resolves.toEqual({
			eventId: "content:studio/recordings/session-1/recording-1/ready.json:abc123",
			cloudRunExecution: "operations/transcode-retry",
		});

		expect(runCount).toBe(2);
		expect(recordings.writes).toHaveLength(1);
		expect(JSON.parse(recordings.writes[0]?.value ?? "{}")).toMatchObject({
			status: "queued",
			recordingId: "recording-1",
		});
		expect(db.statuses.get(
			"content:studio/recordings/session-1/recording-1/ready.json:abc123",
		)).toBe("triggered");
	});

	it("ignores delete events for matching ready marker keys without side effects", async () => {
		const marker = createReadyMarker();
		const db = createDbMock();
		const recordings = createRecordingsMock(marker);
		let runCount = 0;

		await expect(
			handleR2Event(
				createEnv(db.db, recordings.bucket),
				{
					...createReadyEvent(),
					action: "DeleteObject",
					object: {
						key: "studio/recordings/session-1/recording-1/ready.json",
					},
				},
				{
					runTranscodingJob: async () => {
						runCount += 1;
						return "operations/transcode-1";
					},
				},
			),
		).resolves.toEqual({
			ignored: true,
			reason: "not-object-create-action",
		});
		expect(runCount).toBe(0);
		expect(db.writes).toHaveLength(0);
		expect(recordings.writes).toHaveLength(0);
	});

	it("fails malformed markers before writing status or triggering Cloud Run", async () => {
		const marker = {
			...createReadyMarker(),
			sourceKey: "studio/recordings/session-2/recording-1/source.webm",
		};
		const db = createDbMock();
		const recordings = createRecordingsMock(marker);
		let runCount = 0;

		await expect(
			handleR2Event(
				createEnv(db.db, recordings.bucket),
				createReadyEvent(),
				{
					runTranscodingJob: async () => {
						runCount += 1;
						return "operations/transcode-1";
					},
				},
			),
		).rejects.toThrow(
			"sourceKey must be under studio/recordings/session-1/recording-1/",
		);

		expect(runCount).toBe(0);
		expect(recordings.writes).toHaveLength(0);
		expect(db.statuses.get(
			"content:studio/recordings/session-1/recording-1/ready.json:abc123",
		)).toBe("failed");
	});
});

function createReadyMarker(): StudioRecordingReadyMarker {
	return {
		contractVersion: 1,
		videoId: "video-1",
		studioSessionId: "session-1",
		recordingId: "recording-1",
		sourceBucket: "content",
		sourceKey: "studio/recordings/session-1/recording-1/source.webm",
		sourceEtag: "abc123",
		sourceFormat: "webm",
		outputPrefix: "videos/video-1/",
	};
}

function createReadyEvent(): R2EventNotification {
	return {
		action: "PutObject",
		bucket: "content",
		object: {
			key: "studio/recordings/session-1/recording-1/ready.json",
			eTag: "abc123",
		},
		eventTime: "2026-06-06T00:00:00.000Z",
	};
}

function createEnv(db: D1Database, bucket: R2Bucket): Env {
	return {
		DB: db,
		RECORDINGS: bucket,
		GCP_PROJECT_ID: "rawkode-academy-production",
		GCP_REGION: "europe-west2",
		GCP_TRANSCODING_JOB: "transcoding-job",
		GCP_SERVICE_ACCOUNT_JSON: JSON.stringify({
			client_email: "studio-recording-ingest@example.iam.gserviceaccount.com",
			private_key: "unused-in-tests",
		}),
	};
}

function createDbMock() {
	const statuses = new Map<string, string>();
	const writes: Array<{ sql: string; params: unknown[] }> = [];
	const db = {
		prepare: (sql: string) => ({
			bind: (...params: unknown[]) => ({
				run: async () => {
					writes.push({ sql, params });
					if (sql.includes("INSERT OR IGNORE")) {
						const id = String(params[0]);
						if (statuses.has(id)) {
							return { meta: { changes: 0 } };
						}
						statuses.set(id, "received");
					}
					if (sql.includes("UPDATE studio_recording_ingest_events")) {
						const status = String(params[0]);
						const id = String(params.at(-1));
						statuses.set(id, status);
					}
					return { meta: { changes: 1 } };
				},
				first: async () => {
					if (sql.includes("SELECT status")) {
						const id = String(params[0]);
						const status = statuses.get(id);
						return status ? { status } : null;
					}
					return null;
				},
			}),
		}),
	} as unknown as D1Database;
	return { db, statuses, writes };
}

function createRecordingsMock(marker: StudioRecordingReadyMarker) {
	const writes: Array<{
		contentType: string | undefined;
		key: string;
		value: string;
	}> = [];
	const bucket = {
		get: async (key: string) => {
			if (key !== "studio/recordings/session-1/recording-1/ready.json") {
				return null;
			}
			return {
				json: async () => marker,
			};
		},
		put: async (
			key: string,
			value: string,
			options?: R2PutOptions,
		) => {
			const httpMetadata = options?.httpMetadata as R2HTTPMetadata | undefined;
			writes.push({
				contentType: httpMetadata && "contentType" in httpMetadata
					? httpMetadata.contentType
					: undefined,
				key,
				value,
			});
			return null;
		},
	} as unknown as R2Bucket;
	return { bucket, writes };
}
