/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
	assertReadyMarker,
	assertReadyMarkerPathContract,
	createCanonicalStreamKey,
	createEventId,
	createReadyMarkerKey,
	createRecordingPrefix,
	createTranscodeStatus,
	createTranscodeStatusKey,
	isObjectCreateAction,
	isStudioReadyMarker,
	normalizeEtag,
	type R2EventNotification,
	type StudioRecordingReadyMarker,
} from "../src/contracts.js";
import {
	default as ingestWorker,
	handleR2Event,
	type Env,
} from "../src/main.js";
import {
	CloudRunDispatchPendingError,
	createStudioDispatchToken,
	requireCloudRunOperationName,
	runTranscodingJob,
	type CloudRunConfig,
} from "../src/google.js";

describe("studio recording ingest contracts", () => {
	it("accepts only studio ready marker keys", () => {
		expect(
			isStudioReadyMarker("studio/recordings/session-1/recording-1/ready.json"),
		).toBe(true);
		expect(isStudioReadyMarker("videos/video-1/original.mkv")).toBe(false);
		expect(
			isStudioReadyMarker(
				"studio/recordings/session-1/recording-1/source.webm",
			),
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

	it("normalizes quoted R2 ETags without changing their identity", () => {
		expect(normalizeEtag('"abc123"')).toBe("abc123");
		expect(normalizeEtag("abc123")).toBe("abc123");
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
		expect(createCanonicalStreamKey("videos/video-1")).toBe(
			"videos/video-1/stream.m3u8",
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
		const wrangler = JSON.parse(readFileSync("wrangler.jsonc", "utf8")) as {
			d1_databases?: Array<Record<string, string>>;
			secrets_store_secrets?: Array<Record<string, string>>;
		};
		const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
			scripts?: Record<string, string>;
		};
		const claimMigration = readFileSync(
			"data-model/0001_video_output_claims.sql",
			"utf8",
		);
		const processingLeaseMigration = readFileSync(
			"data-model/0002_event_processing_lease.sql",
			"utf8",
		);
		const envCue = readFileSync("env.cue", "utf8");
		const defaultWorkflow = readFileSync(
			"../../../../.github/workflows/rawkode-academy-platform-studio-recording-ingest-default.yml",
			"utf8",
		);
		const pullRequestWorkflow = readFileSync(
			"../../../../.github/workflows/rawkode-academy-platform-studio-recording-ingest-pullrequest.yml",
			"utf8",
		);

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
				'bun x wrangler r2 bucket notification create rawkode-academy-content --event-type object-create --queue platform-studio-recording-ingest --prefix "studio/recordings/" --suffix "/ready.json"',
			"notify:list":
				"bun x wrangler r2 bucket notification list rawkode-academy-content",
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
		expect(readFileSync("scripts/verify-live.ts", "utf8")).toContain(
			"studio_recording_vod_claims",
		);
		expect(readFileSync("scripts/verify-live.ts", "utf8")).toContain(
			"0001_video_output_claims.sql",
		);
		expect(readFileSync("scripts/verify-live.ts", "utf8")).toContain(
			"0002_event_processing_lease.sql",
		);
		expect(claimMigration).toContain("video_id TEXT PRIMARY KEY");
		expect(claimMigration).toContain("recording_id TEXT NOT NULL UNIQUE");
		expect(processingLeaseMigration).toContain("processing_owner TEXT");
		expect(processingLeaseMigration).toContain(
			"processing_lease_until INTEGER",
		);
		expect(processingLeaseMigration).toContain("dispatch_attempted_at INTEGER");
		expect(processingLeaseMigration).toContain(
			"studio_recording_vod_claims_dispatch_token_idx",
		);
		expect(envCue).toContain(
			'tasks: [_t.check, _t.test, _t."deploy.dry-run", _t.migrate, _t.deploy]',
		);
		expect(envCue).toContain('dependsOn: [_t."deploy.dry-run"]');
		expect(envCue).toContain("../../../../bun.lock");
		expect(defaultWorkflow).toContain("environment: production");
		expect(defaultWorkflow).toContain("bun.lock");
		expect(defaultWorkflow).toContain(
			"projects/rawkode.academy/platform/studio-recording-ingest/data-model/**",
		);
		expect(defaultWorkflow).toContain(
			"projects/rawkode.academy/platform/studio-recording-ingest/scripts/**",
		);
		expect(pullRequestWorkflow).not.toContain("environment: production");
		expect(pullRequestWorkflow).not.toContain("OP_SERVICE_ACCOUNT_TOKEN");
		expect(pullRequestWorkflow).not.toContain("CUENV_ENVIRONMENT");
		expect(packageJson.scripts?.["notify:create"]).toContain(
			"--event-type object-create",
		);
		expect(packageJson.scripts?.["notify:create"]).toContain(
			'--prefix "studio/recordings/" --suffix "/ready.json"',
		);
		expect(packageJson.scripts?.["queues:create"]).toContain(
			"bun x wrangler queues create",
		);
	});

	it("requires a Cloud Run operation name before marking jobs triggered", () => {
		expect(
			requireCloudRunOperationName({ name: "operations/transcode-1" }),
		).toBe("operations/transcode-1");
		expect(() => requireCloudRunOperationName({})).toThrow(
			"Cloud Run jobs.run returned no operation name",
		);
	});
});

describe("Cloud Run dispatch reconciliation", () => {
	it("uses a deterministic token for the complete recording identity", async () => {
		const marker = createReadyMarker();
		const token = await createStudioDispatchToken(marker);
		expect(token).toMatch(/^studio-[a-f0-9]{64}$/);
		expect(await createStudioDispatchToken(marker)).toBe(token);
		expect(
			await createStudioDispatchToken(
				createReadyMarker({ sourceEtag: "other" }),
			),
		).not.toBe(token);
	});

	it("reconciles a response-lost dispatch without a second POST", async () => {
		const marker = createReadyMarker();
		const provider = createCloudRunProviderMock({
			responseLoss: true,
			visible: true,
		});
		const execution = await runTranscodingJob(createCloudRunConfig(), marker, {
			accessToken: "test-token",
			fetch: provider.fetch,
			reconcileAttempts: 1,
			reconcileDelayMs: 0,
		});

		expect(execution).toBe(provider.executionName);
		expect(provider.postCount()).toBe(1);
	});

	it("paginates execution history before deciding whether to dispatch", async () => {
		const marker = createReadyMarker();
		const dispatchToken = await createStudioDispatchToken(marker);
		let listCount = 0;
		let postCount = 0;
		const request = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(String(input));
			if (url.pathname.endsWith(":run")) {
				postCount += 1;
				return Response.json({ name: "operations/unexpected" });
			}
			listCount += 1;
			if (!url.searchParams.get("pageToken")) {
				return Response.json({ executions: [], nextPageToken: "next-page" });
			}
			return Response.json({
				executions: [createExecutionDocument(marker, dispatchToken)],
			});
		});

		await expect(
			runTranscodingJob(createCloudRunConfig(), marker, {
				accessToken: "test-token",
				dispatchToken,
				fetch: request as unknown as typeof fetch,
			}),
		).resolves.toContain("/executions/");
		expect(listCount).toBe(2);
		expect(postCount).toBe(0);
	});
});

describe("studio recording ingest worker", () => {
	it("writes queued transcode status before triggering Cloud Run", async () => {
		const marker = createReadyMarker();
		const event = createReadyEvent();
		const db = createDbMock();
		const recordings = createRecordingsMock(marker);
		const calls: Array<{
			config: CloudRunConfig;
			marker: StudioRecordingReadyMarker;
		}> = [];

		const result = await handleR2Event(
			createEnv(db.db, recordings.bucket),
			event,
			{
				runTranscodingJob: async (config, receivedMarker) => {
					calls.push({ config, marker: receivedMarker });
					return "operations/transcode-1";
				},
			},
		);

		expect(result).toEqual({
			eventId:
				"content:studio/recordings/session-1/recording-1/ready.json:abc123",
			cloudRunExecution: "operations/transcode-1",
		});
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
		expect(
			db.writes
				.filter((write) => write.sql.includes("studio_recording_ingest_events"))
				.map((write) => write.params[0]),
		).toEqual([
			"content:studio/recordings/session-1/recording-1/ready.json:abc123",
			"validated",
			"triggered",
		]);
	});

	it("keeps canonical status queued when Cloud Run dispatch is ambiguous", async () => {
		const marker = createReadyMarker();
		const db = createDbMock();
		const recordings = createRecordingsMock(marker);

		await expect(
			handleR2Event(createEnv(db.db, recordings.bucket), createReadyEvent(), {
				runTranscodingJob: async () => {
					throw new Error("Cloud Run unavailable");
				},
			}),
		).rejects.toThrow("Cloud Run unavailable");

		expect(recordings.writes).toHaveLength(1);
		expect(recordings.writes[0]).toMatchObject({
			key: "videos/video-1/transcode-status.json",
			contentType: "application/json",
		});
		expect(JSON.parse(recordings.writes[0]?.value ?? "{}")).toMatchObject({
			status: "queued",
			queuedAt: expect.any(String),
		});
		expect(db.claimsByVideo.get("video-1")).toMatchObject({
			recording_id: "recording-1",
			source_etag: "abc123",
		});
		expect(db.writes.at(-1)?.params.slice(0, 10)).toEqual([
			"failed",
			null,
			"Cloud Run unavailable",
			null,
			null,
			null,
			1,
			1,
			120,
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
			eventId:
				"content:studio/recordings/session-1/recording-1/ready.json:abc123",
			inFlight: false,
			status: "triggered",
		});
		expect(runCount).toBe(1);
		expect(recordings.writes).toHaveLength(0);
	});

	it("allows only one concurrent delivery of the same marker to invoke Cloud Run", async () => {
		const marker = createReadyMarker();
		const event = createReadyEvent(marker);
		const db = createDbMock();
		const recordings = createRecordingsMock(marker);
		const env = createEnv(db.db, recordings.bucket);
		let releaseJob!: () => void;
		const jobGate = new Promise<void>((resolve) => {
			releaseJob = resolve;
		});
		let markJobStarted!: () => void;
		const jobStarted = new Promise<void>((resolve) => {
			markJobStarted = resolve;
		});
		let runCount = 0;
		const runTranscodingJob = async () => {
			runCount += 1;
			markJobStarted();
			await jobGate;
			return "operations/transcode-1";
		};

		const pending = Promise.all([
			handleR2Event(env, event, { runTranscodingJob }),
			handleR2Event(env, event, { runTranscodingJob }),
		]);
		await jobStarted;
		expect(runCount).toBe(1);
		releaseJob();
		const results = await pending;

		expect(runCount).toBe(1);
		expect(results).toContainEqual(
			expect.objectContaining({
				duplicate: true,
				inFlight: true,
			}),
		);
		expect(recordings.writes).toHaveLength(1);
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
			eventId:
				"content:studio/recordings/session-1/recording-1/ready.json:abc123",
			cloudRunExecution: "operations/transcode-retry",
		});

		expect(runCount).toBe(2);
		expect(recordings.writes).toHaveLength(0);
		expect(
			db.statuses.get(
				"content:studio/recordings/session-1/recording-1/ready.json:abc123",
			),
		).toBe("triggered");
		expect(db.claimsByVideo.size).toBe(1);
	});

	it("lets only one concurrent recording claim and trigger a canonical video output", async () => {
		const firstMarker = createReadyMarker();
		const secondMarker = createReadyMarker({
			recordingId: "recording-2",
			studioSessionId: "session-2",
			sourceEtag: "def456",
			sourceKey: "studio/recordings/session-2/recording-2/source.webm",
		});
		const db = createDbMock();
		const recordings = createRecordingsMock([firstMarker, secondMarker]);
		const env = createEnv(db.db, recordings.bucket);
		const triggeredRecordings: string[] = [];
		const runTranscodingJob = async (
			_config: CloudRunConfig,
			marker: StudioRecordingReadyMarker,
		) => {
			triggeredRecordings.push(marker.recordingId);
			return `operations/${marker.recordingId}`;
		};

		const results = await Promise.all([
			handleR2Event(env, createReadyEvent(firstMarker), { runTranscodingJob }),
			handleR2Event(env, createReadyEvent(secondMarker), { runTranscodingJob }),
		]);

		expect(triggeredRecordings).toHaveLength(1);
		expect(
			results.filter((result) => "rejected" in result && result.rejected),
		).toHaveLength(1);
		expect(db.claimsByVideo.size).toBe(1);
		expect(recordings.writes).toHaveLength(1);
		expect(JSON.parse(recordings.writes[0]?.value ?? "{}")).toMatchObject({
			recordingId: triggeredRecordings[0],
			status: "queued",
		});
		expect([...db.statuses.values()].sort()).toEqual(["rejected", "triggered"]);
	});

	it("rejects a source bucket that does not match the ready-marker event bucket", async () => {
		const marker = createReadyMarker({ sourceBucket: "other-content" });
		const db = createDbMock();
		const recordings = createRecordingsMock(marker);
		let runCount = 0;

		await expect(
			handleR2Event(
				createEnv(db.db, recordings.bucket),
				createReadyEvent(marker),
				{
					runTranscodingJob: async () => {
						runCount += 1;
						return "operations/should-not-run";
					},
				},
			),
		).resolves.toMatchObject({
			reason: "recording-source-invalid",
			rejected: true,
		});
		expect(runCount).toBe(0);
		expect(recordings.writes).toHaveLength(0);
		expect(db.claimsByVideo.size).toBe(0);
	});

	it("rejects missing or mismatched recording source objects before claiming output", async () => {
		const marker = createReadyMarker();
		for (const options of [
			{ sourceExists: false },
			{ sourceEtag: '"different-source"' },
		]) {
			const db = createDbMock();
			const recordings = createRecordingsMock(marker, options);
			let runCount = 0;

			await expect(
				handleR2Event(
					createEnv(db.db, recordings.bucket),
					createReadyEvent(marker),
					{
						runTranscodingJob: async () => {
							runCount += 1;
							return "operations/should-not-run";
						},
					},
				),
			).resolves.toMatchObject({
				reason: "recording-source-invalid",
				rejected: true,
			});
			expect(runCount).toBe(0);
			expect(recordings.writes).toHaveLength(0);
			expect(db.claimsByVideo.size).toBe(0);
		}
	});

	it("rejects changed source identity and treats rejected redelivery as terminal", async () => {
		const marker = createReadyMarker();
		const db = createDbMock();
		const recordings = createRecordingsMock(marker);
		const env = createEnv(db.db, recordings.bucket);
		let runCount = 0;
		const runTranscodingJob = async () => {
			runCount += 1;
			return "operations/transcode-1";
		};

		await handleR2Event(env, createReadyEvent(marker), { runTranscodingJob });
		recordings.writes.length = 0;
		const changedMarker = createReadyMarker({
			sourceEtag: "changed-source-etag",
		});
		recordings.setReadyMarker(changedMarker, "changed-marker-etag");
		const changedEvent = createReadyEvent(changedMarker, "changed-marker-etag");

		await expect(
			handleR2Event(env, changedEvent, { runTranscodingJob }),
		).resolves.toMatchObject({
			reason: "canonical-output-conflict",
			rejected: true,
			status: "rejected",
		});
		await expect(
			handleR2Event(env, changedEvent, { runTranscodingJob }),
		).resolves.toMatchObject({
			duplicate: true,
			status: "rejected",
		});
		expect(runCount).toBe(1);
		expect(recordings.writes).toHaveLength(0);
		expect(db.claimsByVideo.get("video-1")?.source_etag).toBe("abc123");
	});

	it("bootstraps a claim from matching completed canonical status", async () => {
		const marker = createReadyMarker();
		const db = createDbMock();
		const recordings = createRecordingsMock(marker, {
			canonicalStatus: {
				...createTranscodeStatus(marker, { status: "complete" }),
				completedAt: "2026-06-06T12:00:00.000Z",
			},
			streamExists: true,
		});
		let runCount = 0;

		await expect(
			handleR2Event(
				createEnv(db.db, recordings.bucket),
				createReadyEvent(marker),
				{
					runTranscodingJob: async () => {
						runCount += 1;
						return "operations/should-not-run";
					},
				},
			),
		).resolves.toMatchObject({
			bootstrapped: true,
			status: "triggered",
		});
		expect(runCount).toBe(0);
		expect(recordings.writes).toHaveLength(0);
		expect(db.claimsByVideo.get("video-1")).toMatchObject({
			recording_id: "recording-1",
			source_etag: "abc123",
		});
	});

	it("fails closed when canonical status belongs to another recording", async () => {
		const marker = createReadyMarker();
		const otherMarker = createReadyMarker({
			recordingId: "recording-2",
			studioSessionId: "session-2",
			sourceEtag: "def456",
			sourceKey: "studio/recordings/session-2/recording-2/source.webm",
		});
		const db = createDbMock();
		const recordings = createRecordingsMock(marker, {
			canonicalStatus: createTranscodeStatus(otherMarker, {
				status: "complete",
			}),
			streamExists: true,
		});
		let runCount = 0;

		await expect(
			handleR2Event(
				createEnv(db.db, recordings.bucket),
				createReadyEvent(marker),
				{
					runTranscodingJob: async () => {
						runCount += 1;
						return "operations/should-not-run";
					},
				},
			),
		).resolves.toMatchObject({
			reason: "canonical-output-conflict",
			rejected: true,
		});
		expect(runCount).toBe(0);
		expect(recordings.writes).toHaveLength(0);
		expect(db.claimsByVideo.size).toBe(0);
	});

	it("fails closed when a canonical stream has no attributable status", async () => {
		const marker = createReadyMarker();
		const db = createDbMock();
		const recordings = createRecordingsMock(marker, { streamExists: true });

		await expect(
			handleR2Event(
				createEnv(db.db, recordings.bucket),
				createReadyEvent(marker),
				{
					runTranscodingJob: async () => "operations/should-not-run",
				},
			),
		).resolves.toMatchObject({
			reason: "canonical-output-conflict",
			rejected: true,
		});
		expect(recordings.writes).toHaveLength(0);
		expect(db.claimsByVideo.size).toBe(0);
	});

	it("terminally rejects a stale marker notification before claiming or dispatching", async () => {
		const marker = createReadyMarker();
		const event = createReadyEvent(marker, "stale-marker-etag");
		const db = createDbMock();
		const recordings = createRecordingsMock(marker);
		let runCount = 0;

		await expect(
			handleR2Event(createEnv(db.db, recordings.bucket), event, {
				runTranscodingJob: async () => {
					runCount += 1;
					return "operations/should-not-run";
				},
			}),
		).resolves.toMatchObject({
			reason: "stale-ready-marker-event",
			rejected: true,
			status: "rejected",
		});
		expect(runCount).toBe(0);
		expect(db.claimsByVideo.size).toBe(0);
		expect(recordings.writes).toHaveLength(0);
	});

	it("retries active event claims instead of acknowledging away crash recovery", async () => {
		const marker = createReadyMarker();
		const event = createReadyEvent(marker);
		const eventId = createEventId(event);
		const db = createDbMock();
		db.seedEvent(eventId, {
			leaseUntil: Math.floor(Date.now() / 1000) + 60,
			owner: "crashed-worker",
			status: "validated",
		});
		const recordings = createRecordingsMock(marker);
		const ack = vi.fn();
		const retry = vi.fn();
		const message = {
			ack,
			attempts: 2,
			body: event,
			id: "queue-message-1",
			retry,
			timestamp: new Date(),
		};

		await ingestWorker.queue(
			{ messages: [message] } as unknown as MessageBatch<R2EventNotification>,
			createEnv(db.db, recordings.bucket),
		);

		expect(ack).not.toHaveBeenCalled();
		expect(retry).toHaveBeenCalledWith({
			delaySeconds: expect.any(Number),
		});
	});

	it("reclaims an expired processing lease after a worker crash", async () => {
		const marker = createReadyMarker();
		const event = createReadyEvent(marker);
		const eventId = createEventId(event);
		const db = createDbMock();
		db.seedEvent(eventId, {
			leaseUntil: Math.floor(Date.now() / 1000) - 1,
			owner: "crashed-worker",
			status: "validated",
		});
		const recordings = createRecordingsMock(marker);
		let runCount = 0;

		await expect(
			handleR2Event(createEnv(db.db, recordings.bucket), event, {
				runTranscodingJob: async () => {
					runCount += 1;
					return "operations/recovered";
				},
			}),
		).resolves.toMatchObject({ cloudRunExecution: "operations/recovered" });
		expect(runCount).toBe(1);
		expect(db.statuses.get(eventId)).toBe("triggered");
	});

	it("does not dispatch twice when persisting the successful event transition fails", async () => {
		const marker = createReadyMarker();
		const event = createReadyEvent(marker);
		const db = createDbMock();
		const recordings = createRecordingsMock(marker);
		const env = createEnv(db.db, recordings.bucket);
		db.failNextTriggeredUpdate();
		let runCount = 0;
		const dispatch = async () => {
			runCount += 1;
			return "operations/transcode-1";
		};

		await expect(
			handleR2Event(env, event, { runTranscodingJob: dispatch }),
		).rejects.toThrow("simulated triggered-state D1 failure");
		await expect(
			handleR2Event(env, event, { runTranscodingJob: dispatch }),
		).resolves.toMatchObject({ cloudRunExecution: "operations/transcode-1" });
		expect(runCount).toBe(1);
		expect(recordings.writes).toHaveLength(1);
		expect(JSON.parse(recordings.writes[0]?.value ?? "{}").status).toBe(
			"queued",
		);
	});

	it("rejects a conflicting Cloud Run execution persisted during dispatch", async () => {
		const marker = createReadyMarker();
		const event = createReadyEvent(marker);
		const db = createDbMock();
		const recordings = createRecordingsMock(marker);

		await expect(
			handleR2Event(createEnv(db.db, recordings.bucket), event, {
				runTranscodingJob: async () => {
					db.setClaimExecution(marker.videoId, "operations/concurrent-winner");
					return "operations/concurrent-loser";
				},
			}),
		).rejects.toThrow(
			"canonical VOD dispatch execution could not be persisted",
		);
		expect(db.claimsByVideo.get(marker.videoId)?.cloud_run_execution).toBe(
			"operations/concurrent-winner",
		);
		expect(recordings.writes).toHaveLength(1);
	});

	it("waits for an initially invisible response-lost execution without reposting", async () => {
		const marker = createReadyMarker();
		const event = createReadyEvent(marker);
		const db = createDbMock();
		const recordings = createRecordingsMock(marker);
		const env = createEnv(db.db, recordings.bucket);
		const provider = createCloudRunProviderMock({
			responseLoss: true,
			visible: false,
		});
		const dispatch = (
			config: CloudRunConfig,
			receivedMarker: StudioRecordingReadyMarker,
			options: Parameters<typeof runTranscodingJob>[2] = {},
		) =>
			runTranscodingJob(config, receivedMarker, {
				...options,
				accessToken: "test-token",
				fetch: provider.fetch,
				reconcileAttempts: 1,
				reconcileDelayMs: 0,
			});

		await expect(
			handleR2Event(env, event, { runTranscodingJob: dispatch }),
		).rejects.toBeInstanceOf(CloudRunDispatchPendingError);
		await expect(
			handleR2Event(env, event, { runTranscodingJob: dispatch }),
		).rejects.toBeInstanceOf(CloudRunDispatchPendingError);
		expect(provider.postCount()).toBe(1);

		provider.setVisible(true);
		await expect(
			handleR2Event(env, event, { runTranscodingJob: dispatch }),
		).resolves.toMatchObject({ cloudRunExecution: provider.executionName });
		expect(provider.postCount()).toBe(1);
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
			handleR2Event(createEnv(db.db, recordings.bucket), createReadyEvent(), {
				runTranscodingJob: async () => {
					runCount += 1;
					return "operations/transcode-1";
				},
			}),
		).rejects.toThrow(
			"sourceKey must be under studio/recordings/session-1/recording-1/",
		);

		expect(runCount).toBe(0);
		expect(recordings.writes).toHaveLength(0);
		expect(
			db.statuses.get(
				"content:studio/recordings/session-1/recording-1/ready.json:abc123",
			),
		).toBe("failed");
	});
});

function createReadyMarker(
	overrides: Partial<StudioRecordingReadyMarker> = {},
): StudioRecordingReadyMarker {
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
		...overrides,
	};
}

function createReadyEvent(
	marker = createReadyMarker(),
	markerEtag = marker.recordingId === "recording-1"
		? "abc123"
		: `${marker.recordingId}-marker-etag`,
): R2EventNotification {
	return {
		action: "PutObject",
		bucket: "content",
		object: {
			key: createReadyMarkerKey(marker),
			eTag: markerEtag,
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

function createCloudRunConfig(): CloudRunConfig {
	return {
		jobName: "transcoding-job",
		location: "europe-west2",
		projectId: "rawkode-academy-production",
		serviceAccount: {
			client_email: "studio-recording-ingest@example.iam.gserviceaccount.com",
			private_key: "unused-in-tests",
		},
	};
}

function createExecutionDocument(
	marker: StudioRecordingReadyMarker,
	dispatchToken: string,
) {
	return {
		name: "projects/rawkode-academy-production/locations/europe-west2/jobs/transcoding-job/executions/studio-recording-1",
		template: {
			containers: [
				{
					env: [
						{ name: "VIDEO_ID", value: marker.videoId },
						{ name: "STUDIO_SESSION_ID", value: marker.studioSessionId },
						{ name: "RECORDING_ID", value: marker.recordingId },
						{ name: "SOURCE_BUCKET", value: marker.sourceBucket },
						{ name: "SOURCE_KEY", value: marker.sourceKey },
						{ name: "SOURCE_ETAG", value: marker.sourceEtag },
						{ name: "SOURCE_FORMAT", value: marker.sourceFormat },
						{ name: "OUTPUT_PREFIX", value: marker.outputPrefix },
						{ name: "STUDIO_DISPATCH_TOKEN", value: dispatchToken },
					],
				},
			],
		},
	};
}

function createCloudRunProviderMock(options: {
	responseLoss: boolean;
	visible: boolean;
}) {
	let execution: ReturnType<typeof createExecutionDocument> | null = null;
	let postCount = 0;
	let visible = options.visible;
	const executionName = createExecutionDocument(
		createReadyMarker(),
		"placeholder",
	).name;
	const request = vi.fn(
		async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = new URL(String(input));
			if (!url.pathname.endsWith(":run")) {
				return Response.json({
					executions: visible && execution ? [execution] : [],
				});
			}

			postCount += 1;
			const body = JSON.parse(String(init?.body)) as {
				overrides: {
					containerOverrides: Array<{
						env: Array<{ name: string; value: string }>;
					}>;
				};
			};
			const environment = new Map(
				body.overrides.containerOverrides[0]?.env.map((entry) => [
					entry.name,
					entry.value,
				]),
			);
			const marker = createReadyMarker({
				recordingId: environment.get("RECORDING_ID") ?? "",
				sourceBucket: environment.get("SOURCE_BUCKET") ?? "",
				sourceEtag: environment.get("SOURCE_ETAG") ?? "",
				sourceFormat: environment.get("SOURCE_FORMAT") as "webm",
				sourceKey: environment.get("SOURCE_KEY") ?? "",
				studioSessionId: environment.get("STUDIO_SESSION_ID") ?? "",
				videoId: environment.get("VIDEO_ID") ?? "",
				outputPrefix: environment.get("OUTPUT_PREFIX") ?? "",
			});
			execution = createExecutionDocument(
				marker,
				environment.get("STUDIO_DISPATCH_TOKEN") ?? "",
			);
			if (options.responseLoss) {
				throw new TypeError(
					"simulated response loss after Cloud Run accepted the run",
				);
			}
			return Response.json({ name: "operations/transcode-1" });
		},
	);
	return {
		executionName,
		fetch: request as unknown as typeof fetch,
		postCount: () => postCount,
		setVisible(value: boolean) {
			visible = value;
		},
	};
}

interface VodClaimRow {
	cloud_run_execution: string | null;
	dispatch_attempted_at: number | null;
	dispatch_token: string | null;
	video_id: string;
	recording_id: string;
	studio_session_id: string;
	source_bucket: string;
	source_key: string;
	source_etag: string;
	source_format: "mkv" | "mp4" | "webm";
	output_prefix: string;
	ready_marker_key: string;
}

function createDbMock() {
	const statuses = new Map<string, string>();
	const eventOwners = new Map<string, string | null>();
	const eventLeaseUntil = new Map<string, number | null>();
	const claimsByVideo = new Map<string, VodClaimRow>();
	const claimsByRecording = new Map<string, VodClaimRow>();
	const writes: Array<{ sql: string; params: unknown[] }> = [];
	let shouldFailNextTriggeredUpdate = false;
	const db = {
		prepare: (sql: string) => ({
			bind: (...params: unknown[]) => ({
				run: async () => {
					writes.push({ sql, params });
					if (
						sql.includes("INSERT OR IGNORE INTO studio_recording_ingest_events")
					) {
						const id = String(params[0]);
						if (statuses.has(id)) {
							return { meta: { changes: 0 } };
						}
						statuses.set(id, "processing");
						eventOwners.set(id, String(params[4]));
						eventLeaseUntil.set(
							id,
							Math.floor(Date.now() / 1000) + Number(params[5]),
						);
						return { meta: { changes: 1 } };
					}
					if (
						sql.includes("INSERT OR IGNORE INTO studio_recording_vod_claims")
					) {
						const row: VodClaimRow = {
							cloud_run_execution: null,
							dispatch_attempted_at: null,
							dispatch_token: null,
							video_id: String(params[0]),
							recording_id: String(params[1]),
							studio_session_id: String(params[2]),
							source_bucket: String(params[3]),
							source_key: String(params[4]),
							source_etag: String(params[5]),
							source_format: String(params[6]) as VodClaimRow["source_format"],
							output_prefix: String(params[7]),
							ready_marker_key: String(params[8]),
						};
						if (
							claimsByVideo.has(row.video_id) ||
							claimsByRecording.has(row.recording_id)
						) {
							return { meta: { changes: 0 } };
						}
						claimsByVideo.set(row.video_id, row);
						claimsByRecording.set(row.recording_id, row);
						return { meta: { changes: 1 } };
					}
					if (
						sql.includes("UPDATE studio_recording_ingest_events") &&
						sql.includes("status IN ('processing', 'received', 'validated')")
					) {
						const id = String(params[2]);
						const status = statuses.get(id);
						const leaseUntil = eventLeaseUntil.get(id);
						const reclaimable =
							status === "failed" ||
							(["processing", "received", "validated"].includes(status ?? "") &&
								(leaseUntil === null ||
									leaseUntil === undefined ||
									leaseUntil <= Math.floor(Date.now() / 1000)));
						if (!reclaimable) {
							return { meta: { changes: 0 } };
						}
						statuses.set(id, "processing");
						eventOwners.set(id, String(params[0]));
						eventLeaseUntil.set(
							id,
							Math.floor(Date.now() / 1000) + Number(params[1]),
						);
						return { meta: { changes: 1 } };
					}
					if (sql.includes("UPDATE studio_recording_ingest_events")) {
						const status = String(params[0]);
						if (status === "triggered" && shouldFailNextTriggeredUpdate) {
							shouldFailNextTriggeredUpdate = false;
							throw new Error("simulated triggered-state D1 failure");
						}
						const id = String(params.at(-2));
						const owner = String(params.at(-1));
						if (
							eventOwners.get(id) !== owner ||
							(eventLeaseUntil.get(id) ?? 0) <= Math.floor(Date.now() / 1000)
						) {
							return { meta: { changes: 0 } };
						}
						statuses.set(id, status);
						if (["failed", "rejected", "triggered"].includes(status)) {
							eventOwners.set(id, null);
							eventLeaseUntil.set(id, null);
						} else {
							eventLeaseUntil.set(
								id,
								Math.floor(Date.now() / 1000) + Number(params.at(-3)),
							);
						}
						return { meta: { changes: 1 } };
					}
					if (
						sql.includes("UPDATE studio_recording_vod_claims") &&
						sql.includes("SET dispatch_token")
					) {
						const row = claimsByVideo.get(String(params[1]));
						if (
							!row ||
							row.recording_id !== String(params[2]) ||
							row.cloud_run_execution
						) {
							return { meta: { changes: 0 } };
						}
						const eligibleBefore = Number(params[4]);
						if (
							(row.dispatch_token &&
								row.dispatch_token !== String(params[3])) ||
							(row.dispatch_attempted_at !== null &&
								row.dispatch_attempted_at > eligibleBefore)
						) {
							return { meta: { changes: 0 } };
						}
						row.dispatch_token = String(params[0]);
						row.dispatch_attempted_at = Math.floor(Date.now() / 1000);
						return { meta: { changes: 1 } };
					}
					if (
						sql.includes("UPDATE studio_recording_vod_claims") &&
						sql.includes("SET cloud_run_execution")
					) {
						const row = claimsByVideo.get(String(params[1]));
						if (
							!row ||
							row.recording_id !== String(params[2]) ||
							row.dispatch_token !== String(params[3])
						) {
							return { meta: { changes: 0 } };
						}
						if (
							row.cloud_run_execution &&
							row.cloud_run_execution !== String(params[4])
						) {
							return { meta: { changes: 0 } };
						}
						row.cloud_run_execution = String(params[0]);
						return { meta: { changes: 1 } };
					}
					return { meta: { changes: 1 } };
				},
				first: async () => {
					if (sql.includes("SELECT status, processing_lease_until")) {
						const id = String(params[0]);
						const status = statuses.get(id);
						return status
							? {
									processing_lease_until: eventLeaseUntil.get(id) ?? null,
									status,
								}
							: null;
					}
					if (
						sql.includes("FROM studio_recording_vod_claims") &&
						sql.includes("WHERE video_id = ?")
					) {
						return claimsByVideo.get(String(params[0])) ?? null;
					}
					if (
						sql.includes("FROM studio_recording_vod_claims") &&
						sql.includes("WHERE recording_id = ?")
					) {
						return claimsByRecording.get(String(params[0])) ?? null;
					}
					return null;
				},
			}),
		}),
	} as unknown as D1Database;
	return {
		claimsByRecording,
		claimsByVideo,
		db,
		eventLeaseUntil,
		eventOwners,
		failNextTriggeredUpdate() {
			shouldFailNextTriggeredUpdate = true;
		},
		seedEvent(
			id: string,
			input: {
				leaseUntil: number | null;
				owner: string | null;
				status: string;
			},
		) {
			statuses.set(id, input.status);
			eventOwners.set(id, input.owner);
			eventLeaseUntil.set(id, input.leaseUntil);
		},
		setClaimExecution(videoId: string, execution: string) {
			const row = claimsByVideo.get(videoId);
			if (!row) throw new Error(`missing claim for ${videoId}`);
			row.cloud_run_execution = execution;
		},
		statuses,
		writes,
	};
}

function createRecordingsMock(
	marker: StudioRecordingReadyMarker | StudioRecordingReadyMarker[],
	options: {
		canonicalStatus?: unknown;
		canonicalStatusJsonError?: boolean;
		sourceEtag?: string;
		sourceExists?: boolean;
		streamExists?: boolean;
	} = {},
) {
	const readyMarkers = new Map<
		string,
		{ etag: string; marker: StudioRecordingReadyMarker }
	>();
	for (const value of Array.isArray(marker) ? marker : [marker]) {
		readyMarkers.set(createReadyMarkerKey(value), {
			etag: createReadyEvent(value).object.eTag ?? "",
			marker: value,
		});
	}
	let canonicalStatus = options.canonicalStatus;
	const writes: Array<{
		contentType: string | undefined;
		key: string;
		value: string;
	}> = [];
	const bucket = {
		get: async (key: string) => {
			const readyMarker = readyMarkers.get(key);
			if (readyMarker) {
				return {
					etag: readyMarker.etag,
					json: async () => readyMarker.marker,
				};
			}
			if (
				key ===
				createTranscodeStatusKey(
					(Array.isArray(marker) ? marker[0] : marker).outputPrefix,
				)
			) {
				if (canonicalStatus === undefined) return null;
				return {
					json: async () => {
						if (options.canonicalStatusJsonError) {
							throw new Error("invalid canonical status JSON");
						}
						return canonicalStatus;
					},
				};
			}
			return null;
		},
		head: async (key: string) => {
			const sourceMarker = [...readyMarkers.values()]
				.map((value) => value.marker)
				.find((value) => value.sourceKey === key);
			if (sourceMarker && options.sourceExists !== false) {
				return {
					etag: options.sourceEtag ?? `"${sourceMarker.sourceEtag}"`,
					key,
				} as R2Object;
			}
			return options.streamExists &&
				key ===
					createCanonicalStreamKey(
						(Array.isArray(marker) ? marker[0] : marker).outputPrefix,
					)
				? ({ key } as R2Object)
				: null;
		},
		put: async (key: string, value: string, options?: R2PutOptions) => {
			const httpMetadata = options?.httpMetadata as R2HTTPMetadata | undefined;
			writes.push({
				contentType:
					httpMetadata && "contentType" in httpMetadata
						? httpMetadata.contentType
						: undefined,
				key,
				value,
			});
			if (key.endsWith("/transcode-status.json")) {
				canonicalStatus = JSON.parse(value);
			}
			return null;
		},
	} as unknown as R2Bucket;
	return {
		bucket,
		setReadyMarker(value: StudioRecordingReadyMarker, etag?: string) {
			readyMarkers.set(createReadyMarkerKey(value), {
				etag: etag ?? createReadyEvent(value).object.eTag ?? "",
				marker: value,
			});
		},
		writes,
	};
}
