import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioEnv, StudioUser } from "../env";
import {
	canonicalQuery,
	canonicalRequest,
	sha256Hex,
} from "./machine-auth";
import {
	createStudioSession,
	markStudioRecordingReady,
} from "./operations";
import {
	buildAdoptBody,
	claimReviewRecording,
	maxReviewTranscodeAttempts,
	promotionCheckSeconds,
	reconcileReviewRecordings,
	requestReviewAdoption,
	reviewBackoffSeconds,
} from "./payload-handoff";
import {
	buildStudioSession,
	createApprovedReadyMarker,
	createReadyMarker,
	createReviewReadyMarker,
	saveStudioSession,
	type StudioReviewRecordingRow,
} from "./studio";
import { createBucketDouble, createSqliteD1 } from "./testing/doubles";

const secret = "studio-machine-secret-for-tests-0123456789";
const operator: StudioUser = {
	id: "rawkode",
	email: "rawkode@users.noreply.github.com",
	image: null,
	name: "Rawkode",
	username: "rawkode",
	issuer: "https://id.rawkode.academy",
	subject: "HmYDQjc3JVFo7visJIL5FneGFzNAJjDT",
};
const recordingId = "recording-1";
const sourceKey = `studio/recordings/session-1/${recordingId}/source.webm`;
const readyKey = `studio/recordings/session-1/${recordingId}/ready.json`;

type PayloadReply = Response | Error | "hang" | ((request: Request) => Promise<Response>);
const summary = (state: string, extra: Record<string, unknown> = {}) =>
	Response.json({ adoptionId: "adoption-1", videoId: 42, state, revisionId: null, error: null, publication: null, ...extra });

async function setup(options: { reviewRequired?: boolean; payload?: boolean } = {}) {
	const d1 = createSqliteD1();
	const content = createBucketDouble();
	const requests: Request[] = [];
	const bodies: string[] = [];
	const replies: PayloadReply[] = [];
	const fetcher = {
		async fetch(request: Request) {
			requests.push(request);
			bodies.push(request.method === "POST" ? await request.clone().text() : "");
			const reply = replies.shift() ?? summary("awaiting-transcode");
			if (reply === "hang") {
				return await new Promise<Response>((_, reject) => {
					request.signal.addEventListener("abort", () => reject(request.signal.reason));
				});
			}
			if (reply instanceof Error) throw reply;
			if (typeof reply === "function") return await reply(request);
			return reply;
		},
	} as unknown as Fetcher;
	const env: StudioEnv = {
		STUDIO_DB: d1.db,
		RECORDINGS: content.bucket,
		RECORDINGS_BUCKET_NAME: "rawkode-academy-content",
		STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		...(options.payload === false
			? {}
			: {
				PAYLOAD: fetcher,
				PAYLOAD_HANDOFF_URL: "https://admin.rawkode.academy/api/studio-handoff/adoptions",
				STUDIO_MACHINE_SECRET: { get: async () => secret },
			}),
	};
	await saveStudioSession(env, buildStudioSession({
		contentVideoId: "video-1",
		createdBy: operator,
		meeting: null,
		reviewRequired: options.reviewRequired ?? true,
		sessionId: "session-1",
		show: "Rawkode Live",
		title: "Review take",
	}));
	content.set(sourceKey, "x".repeat(4096), "source-etag-1");
	const deferred: Promise<unknown>[] = [];
	const mark = (extra: Record<string, unknown> = {}, defer = true) =>
		markStudioRecordingReady(env, operator, {
			recordingId,
			sessionId: "session-1",
			sourceEtag: "source-etag-1",
			sourceFormat: "webm",
			sourceKey,
			...extra,
		}, defer ? { defer: (promise) => deferred.push(promise) } : {});
	const row = () => d1.row("SELECT * FROM studio_recordings WHERE recording_id = ?", recordingId) as unknown as StudioReviewRecordingRow;
	const setRow = (sql: string, ...values: Array<string | number | null>) =>
		d1.sqlite.prepare(`UPDATE studio_recordings SET ${sql} WHERE recording_id = '${recordingId}'`).run(...values);
	return { d1, content, env, requests, bodies, replies, deferred, mark, row, setRow };
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("Studio to Payload review handoff", () => {
	it("hands off a signed, idempotent adoption without waiting for Payload", async () => {
		const h = await setup();
		const marker = await h.mark();
		expect(marker).toMatchObject({ contractVersion: 2, visibility: "review", transcodeAttempt: 0 });
		expect(h.requests).toHaveLength(0);
		expect(h.deferred).toHaveLength(1);
		await Promise.all(h.deferred);
		expect(h.requests).toHaveLength(1);
		const request = h.requests[0]!;
		expect(request.method).toBe("POST");
		expect(new URL(request.url).pathname).toBe("/api/studio-handoff/adoptions");
		expect(request.headers.get("cookie")).toBeNull();
		const body = JSON.parse(h.bodies[0]!);
		expect(body).toEqual({
			idempotencyKey: "studio:session-1:recording-1:source-etag-1",
			legacyVideoId: "video-1",
			studioSessionId: "session-1",
			recordingId,
			source: { bucket: "rawkode-academy-content", key: sourceKey, etag: "source-etag-1", bytes: 4096, format: "webm" },
			reviewPrefix: "studio/recordings/session-1/recording-1/review/",
			requestedBy: { githubHandle: "rawkode", issuer: "https://id.rawkode.academy", subject: operator.subject },
		});
		expect(request.headers.get("idempotency-key")).toBe(body.idempotencyKey);
		// The signature verifies with Payload's canonical string and the shared secret.
		const canonical = canonicalRequest({
			method: "POST",
			path: "/api/studio-handoff/adoptions",
			query: canonicalQuery(""),
			principal: "rawkode-studio",
			timestamp: Number(request.headers.get("x-rawkode-timestamp")),
			idempotencyKey: body.idempotencyKey,
			bodySha256: await sha256Hex(h.bodies[0]!),
		});
		const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
		const signature = request.headers.get("x-rawkode-signature")!.slice(3);
		const bytes = new Uint8Array(signature.match(/../g)!.map((pair) => parseInt(pair, 16)));
		expect(await crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(canonical))).toBe(true);
		expect(buildAdoptBody(h.row())).toEqual(body);
	});

	it("maps awaiting and attached without bumping attempts", async () => {
		const h = await setup();
		await h.mark({}, false);
		h.replies.push(summary("awaiting-transcode"));
		expect(await requestReviewAdoption(h.env, recordingId, { now: 1000 })).toEqual({ status: "awaiting-transcode" });
		expect(h.row()).toMatchObject({ review_state: "awaiting-transcode", review_attempts: 0, review_next_attempt_at: 1060, review_adoption_id: "adoption-1", review_payload_video_id: 42 });
		h.replies.push(summary("attached", { revisionId: "revision-1" }));
		expect(await requestReviewAdoption(h.env, recordingId, { now: 1060 })).toEqual({ status: "attached" });
		expect(h.row()).toMatchObject({ review_state: "attached", review_revision_id: "revision-1", review_next_attempt_at: 1060, review_attached_at: 1060 });
		// Attached rows are polled with a signed GET by adoption id.
		h.replies.push(summary("attached", { revisionId: "revision-1" }));
		await requestReviewAdoption(h.env, recordingId, { now: 1100 });
		const poll = h.requests.at(-1)!;
		expect(poll.method).toBe("GET");
		expect(new URL(poll.url).searchParams.get("adoptionId")).toBe("adoption-1");
		expect(h.row().review_next_attempt_at).toBe(1400);
	});

	it("retriggers a persistent transcode failure with a new marker, at most three times", async () => {
		const h = await setup();
		await h.mark({}, false);
		const firstEtag = h.content.etag(readyKey);
		expect(h.row().review_marker_etag).toBe(firstEtag);
		// The first failed read may be an ingest retry in flight: wait one poll.
		h.replies.push(summary("failed", { error: "Cloud Run jobs.run failed" }));
		expect(await requestReviewAdoption(h.env, recordingId, { now: 2000 })).toEqual({ status: "failed" });
		expect(h.content.etag(readyKey)).toBe(firstEtag);
		expect(h.row()).toMatchObject({ review_state: "failed", review_last_error: "Cloud Run jobs.run failed", review_next_attempt_at: 2300 });
		h.replies.push(summary("failed", { error: "Cloud Run jobs.run failed" }));
		expect(await requestReviewAdoption(h.env, recordingId, { now: 2300 })).toEqual({ status: "awaiting-transcode" });
		const marker = JSON.parse(h.content.text(readyKey)!);
		expect(marker).toEqual(createReviewReadyMarker({ videoId: "video-1", studioSessionId: "session-1", recordingId, sourceBucket: "rawkode-academy-content", sourceKey, sourceEtag: "source-etag-1", sourceFormat: "webm" }, 1));
		expect(h.content.etag(readyKey)).not.toBe(firstEtag);
		expect(h.row()).toMatchObject({ review_transcode_attempt: 1, review_marker_etag: h.content.etag(readyKey), review_state: "awaiting-transcode", review_next_attempt_at: 2360 });
		expect(h.content.puts.at(-1)?.onlyIf).toEqual({ etagMatches: firstEtag });
		h.setRow("review_transcode_attempt = ?, review_state = 'failed', review_next_attempt_at = NULL", maxReviewTranscodeAttempts);
		const capped = h.content.etag(readyKey);
		h.replies.push(summary("failed", { error: "still failing" }));
		await requestReviewAdoption(h.env, recordingId, { now: 3000 });
		expect(h.content.etag(readyKey)).toBe(capped);
		expect(h.row()).toMatchObject({ review_state: "failed", review_next_attempt_at: 3000 + 21600 });
	});

	it("backs off on 404, 5xx and network errors, and parks conflicts", async () => {
		const h = await setup();
		await h.mark({}, false);
		const replies: PayloadReply[] = [
			new Response("missing", { status: 404 }),
			new Response("unavailable", { status: 503 }),
			new TypeError("network down"),
			new Response("error", { status: 500 }),
			new Response("error", { status: 502 }),
			new Response("unauthorized", { status: 401 }),
		];
		let now = 5000;
		const delays: number[] = [];
		for (const reply of replies) {
			h.replies.push(reply);
			expect(await requestReviewAdoption(h.env, recordingId, { now })).toEqual({ status: "retrying" });
			delays.push(Number(h.row().review_next_attempt_at) - now);
			now = Number(h.row().review_next_attempt_at);
		}
		expect(delays).toEqual([...reviewBackoffSeconds, 21600]);
		expect(h.row()).toMatchObject({ review_attempts: 6, review_state: "pending" });
		expect(String(h.row().review_last_error)).toContain("Payload 401");
		h.replies.push(new Response(JSON.stringify({ error: "Studio source changed" }), { status: 409 }));
		expect(await requestReviewAdoption(h.env, recordingId, { now })).toEqual({ status: "parked" });
		expect(h.row()).toMatchObject({ review_next_attempt_at: now + 21600 });
		expect(String(h.row().review_last_error)).toContain("Studio source changed");
		// Success resets the attempt counter.
		h.replies.push(summary("awaiting-transcode"));
		await requestReviewAdoption(h.env, recordingId, { now: now + 21600 });
		expect(h.row().review_attempts).toBe(0);
	});

	it("leases a row so the immediate call and the cron never both send", async () => {
		const h = await setup();
		await h.mark({}, false);
		let release!: () => void;
		h.replies.push(async () => {
			await new Promise<void>((resolve) => { release = resolve; });
			return summary("awaiting-transcode");
		});
		const immediate = requestReviewAdoption(h.env, recordingId, { now: 7000 });
		await vi.waitFor(() => expect(h.requests).toHaveLength(1));
		expect(await reconcileReviewRecordings(h.env, 7001)).toEqual([]);
		expect(await requestReviewAdoption(h.env, recordingId, { now: 7002 })).toEqual({ status: "busy" });
		release();
		await immediate;
		expect(h.requests).toHaveLength(1);
		expect(await claimReviewRecording(h.env.STUDIO_DB!, recordingId, 7030)).toBeNull();
		expect(await claimReviewRecording(h.env.STUDIO_DB!, recordingId, 7060)).not.toBeNull();
	});

	it("reconciles only due review rows and never touches public recordings", async () => {
		const h = await setup({ reviewRequired: false });
		await h.mark({}, false);
		expect(h.row().visibility).toBe("public");
		h.d1.sqlite.prepare("UPDATE studio_sessions SET review_required = 1 WHERE id = 'session-1'").run();
		const second = "recording-2";
		h.content.set(`studio/recordings/session-1/${second}/source.webm`, "y".repeat(10), "source-etag-2");
		await markStudioRecordingReady(h.env, operator, { recordingId: second, sessionId: "session-1", sourceEtag: "source-etag-2", sourceFormat: "webm", sourceKey: `studio/recordings/session-1/${second}/source.webm` });
		const results = await reconcileReviewRecordings(h.env, 8000);
		expect(results.map((result) => result.recordingId)).toEqual([second]);
		expect(h.requests).toHaveLength(1);
		// Not due yet: nothing is sent.
		expect(await reconcileReviewRecordings(h.env, 8030)).toEqual([]);
		expect(h.requests).toHaveLength(1);
		expect(h.row().review_state).toBeNull();
	});

	it("promotes a published recording with an etag-conditional approved marker", async () => {
		const h = await setup();
		await h.mark({}, false);
		h.replies.push(summary("attached", { revisionId: "revision-1" }));
		await requestReviewAdoption(h.env, recordingId, { now: 9000 });
		const reviewEtag = h.content.etag(readyKey);
		h.replies.push(summary("attached", { revisionId: "revision-1", publication: { publicationId: "publication-1", publishedAt: "2026-10-09T12:00:00.000Z" } }));
		expect(await requestReviewAdoption(h.env, recordingId, { now: 9000 })).toEqual({ status: "promoted" });
		expect(h.content.text(readyKey)).toBe(JSON.stringify(createApprovedReadyMarker({ videoId: "video-1", studioSessionId: "session-1", recordingId, sourceBucket: "rawkode-academy-content", sourceKey, sourceEtag: "source-etag-1", sourceFormat: "webm" }, 0), null, 2));
		expect(JSON.parse(h.content.text(readyKey)!)).toMatchObject({ outputMode: "hls-approved", outputPrefix: "videos/video-1/" });
		expect(h.content.puts.at(-1)?.onlyIf).toEqual({ etagMatches: reviewEtag });
		expect(h.row()).toMatchObject({ review_state: "promoted", review_publication_id: "publication-1", review_published_at: Date.parse("2026-10-09T12:00:00.000Z") / 1000, output_prefix: "videos/video-1/", review_promoted_at: 9000, review_next_attempt_at: 9000 + promotionCheckSeconds });
		// The cron watches the public transcode until it completes, then stops.
		h.content.set("videos/video-1/transcode-status.json", JSON.stringify({ status: "complete", outputMode: "hls-approved", recordingId, sourceEtag: "source-etag-1", completedAt: new Date().toISOString() }), "public-status");
		const watched = await reconcileReviewRecordings(h.env, 9000 + promotionCheckSeconds);
		expect(watched).toEqual([{ recordingId, result: { status: "promoted" } }]);
		expect(h.row()).toMatchObject({ review_state: "promoted", review_next_attempt_at: null, review_last_error: null });
		expect(await reconcileReviewRecordings(h.env, 99999)).toEqual([]);
		expect(h.requests).toHaveLength(2);
	});

	it("records an error and does not promote when the ready marker changed underneath", async () => {
		const h = await setup();
		await h.mark({}, false);
		h.content.set(readyKey, "{}", "someone-else");
		h.replies.push(summary("attached", { revisionId: "revision-1", publication: { publicationId: "publication-1", publishedAt: "2026-10-09T12:00:00.000Z" } }));
		expect(await requestReviewAdoption(h.env, recordingId, { now: 9500 })).toEqual({ status: "parked" });
		expect(h.content.text(readyKey)).toBe("{}");
		expect(h.row()).toMatchObject({ review_state: "published", review_last_error: "Ready marker changed; promotion refused", review_next_attempt_at: 9500 + 21600 });
	});

	it("re-triggers a failed or stalled public transcode after promotion, at most three times", async () => {
		const h = await setup();
		await h.mark({}, false);
		const start = 1_800_000_000;
		const at = (seconds: number) => {
			h.content.setClock(seconds);
			return { now: seconds };
		};
		const iso = (seconds: number) => new Date(seconds * 1000).toISOString();
		const input = { videoId: "video-1", studioSessionId: "session-1", recordingId, sourceBucket: "rawkode-academy-content", sourceKey, sourceEtag: "source-etag-1", sourceFormat: "webm" as const };
		h.replies.push(summary("attached", { revisionId: "revision-1", publication: { publicationId: "publication-1", publishedAt: "2026-10-09T12:00:00.000Z" } }));
		expect(await requestReviewAdoption(h.env, recordingId, at(start))).toEqual({ status: "promoted" });
		const statusKey = "videos/video-1/transcode-status.json";
		const status = (fields: Record<string, unknown>) => h.content.set(statusKey, JSON.stringify({ outputMode: "hls-approved", recordingId, sourceEtag: "source-etag-1", ...fields }), crypto.randomUUID());
		// Still running: check again later.
		status({ status: "running", startedAt: iso(start + 10) });
		expect(await requestReviewAdoption(h.env, recordingId, at(start + 900))).toEqual({ status: "promoted" });
		expect(JSON.parse(h.content.text(readyKey)!)).toEqual(createApprovedReadyMarker(input, 0));
		// A fresh failure may already be a Cloud Run retry; one older than a check
		// interval is re-triggered.
		status({ status: "failed", failedAt: iso(start + 1000), error: "ffmpeg exited 1" });
		h.setRow("review_next_attempt_at = 0");
		expect(await requestReviewAdoption(h.env, recordingId, at(start + 1200))).toEqual({ status: "promoted" });
		expect(h.row().review_promotion_attempt).toBe(0);
		expect(await requestReviewAdoption(h.env, recordingId, at(start + 2100))).toEqual({ status: "promoted" });
		expect(JSON.parse(h.content.text(readyKey)!)).toEqual(createApprovedReadyMarker(input, 1));
		expect(h.row()).toMatchObject({ review_promotion_attempt: 1, review_marker_etag: h.content.etag(readyKey), review_next_attempt_at: start + 2100 + promotionCheckSeconds });
		expect(String(h.row().review_last_error)).toContain("ffmpeg exited 1");
		// The old failure predates the new marker, so it is ignored; no run reports
		// for more than 4 hours after the new marker: stalled.
		expect(await requestReviewAdoption(h.env, recordingId, at(start + 3000))).toEqual({ status: "promoted" });
		expect(h.row().review_promotion_attempt).toBe(1);
		expect(await requestReviewAdoption(h.env, recordingId, at(start + 2100 + 4 * 3600 + 1))).toEqual({ status: "promoted" });
		expect(JSON.parse(h.content.text(readyKey)!)).toEqual(createApprovedReadyMarker(input, 2));
		expect(String(h.row().review_last_error)).toContain("stalled");
		// Exhausted: the error stays visible and the watchdog stops.
		h.setRow("review_promotion_attempt = ?, review_next_attempt_at = 0", maxReviewTranscodeAttempts);
		status({ status: "failed", failedAt: iso(start + 6 * 3600), error: "ffmpeg exited 1" });
		const marker = h.content.etag(readyKey);
		expect(await requestReviewAdoption(h.env, recordingId, at(start + 10 * 3600))).toEqual({ status: "promoted" });
		expect(h.content.etag(readyKey)).toBe(marker);
		expect(h.row()).toMatchObject({ review_state: "promoted", review_next_attempt_at: null });
		expect(String(h.row().review_last_error)).toContain("gave up after 3 retries");
	});

	it("adopts its own marker when the D1 update after the R2 put failed", async () => {
		for (const path of ["promotion", "retrigger"] as const) {
			const h = await setup();
			await h.mark({}, false);
			const db = h.env.STUDIO_DB!;
			const match = path === "promotion" ? "output_prefix = ?" : "review_transcode_attempt = ?";
			let armed = true;
			h.env.STUDIO_DB = {
				...db,
				prepare(query: string) {
					const statement = db.prepare(query);
					if (armed && query.includes(match)) {
						armed = false;
						statement.run = async () => { throw new Error("D1 unavailable"); };
					}
					return statement;
				},
			} as D1Database;
			const input = { videoId: "video-1", studioSessionId: "session-1", recordingId, sourceBucket: "rawkode-academy-content", sourceKey, sourceEtag: "source-etag-1", sourceFormat: "webm" as const };
			if (path === "promotion") {
				h.replies.push(summary("attached", { revisionId: "revision-1", publication: { publicationId: "publication-1", publishedAt: "2026-10-09T12:00:00.000Z" } }));
				await expect(requestReviewAdoption(h.env, recordingId, { now: 9000 })).rejects.toThrow("D1 unavailable");
				expect(JSON.parse(h.content.text(readyKey)!)).toEqual(createApprovedReadyMarker(input, 0));
				expect(h.row()).toMatchObject({ review_state: "published" });
				expect(await requestReviewAdoption(h.env, recordingId, { now: 9200 })).toEqual({ status: "promoted" });
				expect(h.row()).toMatchObject({ review_state: "promoted", review_marker_etag: h.content.etag(readyKey), review_last_error: null });
			} else {
				h.replies.push(summary("failed", { error: "boom" }));
				await requestReviewAdoption(h.env, recordingId, { now: 2000 });
				h.replies.push(summary("failed", { error: "boom" }));
				await expect(requestReviewAdoption(h.env, recordingId, { now: 2300 })).rejects.toThrow("D1 unavailable");
				expect(JSON.parse(h.content.text(readyKey)!)).toEqual(createReviewReadyMarker(input, 1));
				expect(h.row().review_transcode_attempt).toBe(0);
				h.replies.push(summary("failed", { error: "boom" }));
				expect(await requestReviewAdoption(h.env, recordingId, { now: 2500 })).toEqual({ status: "awaiting-transcode" });
				expect(h.row()).toMatchObject({ review_transcode_attempt: 1, review_marker_etag: h.content.etag(readyKey), review_state: "awaiting-transcode" });
				expect(JSON.parse(h.content.text(readyKey)!)).toEqual(createReviewReadyMarker(input, 1));
			}
		}
	});

	it("promotes one take per video at a time, and the newest publication wins", async () => {
		const h = await setup();
		await h.mark({}, false);
		const second = "recording-2";
		const secondKey = `studio/recordings/session-1/${second}/source.webm`;
		h.content.set(secondKey, "y".repeat(10), "source-etag-2");
		await markStudioRecordingReady(h.env, operator, { recordingId: second, sessionId: "session-1", sourceEtag: "source-etag-2", sourceFormat: "webm", sourceKey: secondKey });
		const set = (id: string, sql: string) => h.d1.sqlite.prepare(`UPDATE studio_recordings SET ${sql} WHERE recording_id = ?`).run(id);
		// Both published before the cron ran: only the newer publication is promoted.
		set(recordingId, "review_state = 'published', review_publication_id = 'publication-1', review_published_at = 100, review_next_attempt_at = NULL");
		set(second, "review_state = 'published', review_publication_id = 'publication-2', review_published_at = 200, review_next_attempt_at = NULL");
		const reviewMarker = h.content.text(readyKey);
		const results = await reconcileReviewRecordings(h.env, 20_000);
		expect(results).toEqual([
			{ recordingId, result: { status: "withdrawn" } },
			{ recordingId: second, result: { status: "promoted" } },
		]);
		expect(h.content.text(readyKey)).toBe(reviewMarker);
		expect(h.row()).toMatchObject({ review_state: "withdrawn", review_next_attempt_at: null });
		expect(String(h.row().review_last_error)).toContain("Superseded");
		// A later publication waits while another take's public transcode is in flight.
		set(recordingId, "review_state = 'published', review_published_at = 300, review_last_error = NULL");
		expect(await requestReviewAdoption(h.env, recordingId, { now: 20_100 })).toEqual({ status: "published" });
		expect(h.row()).toMatchObject({ review_state: "published", review_next_attempt_at: 20_400 });
		expect(h.content.text(readyKey)).toBe(reviewMarker);
		set(second, "review_next_attempt_at = NULL");
		expect(await requestReviewAdoption(h.env, recordingId, { now: 20_400 })).toEqual({ status: "promoted" });
		expect(JSON.parse(h.content.text(readyKey)!)).toMatchObject({ outputMode: "hls-approved" });
	});

	it("rewrites a ready marker that was never written, or marks the take failed", async () => {
		const h = await setup();
		await h.mark({}, false);
		const original = h.content.text(readyKey);
		h.content.remove(readyKey);
		h.setRow("status = 'marker-pending', updated_at = 0, review_marker_etag = NULL");
		await reconcileReviewRecordings(h.env, 30_000);
		expect(h.content.text(readyKey)).toBe(original);
		expect(h.row()).toMatchObject({ status: "ready", review_marker_etag: h.content.etag(readyKey) });
		expect(h.requests).toHaveLength(1);
		// The source changed before the marker existed: visible failure, nothing written.
		h.content.remove(readyKey);
		h.content.set(sourceKey, "z", "source-etag-other");
		h.setRow("status = 'marker-pending', updated_at = 0, review_state = 'pending'");
		await reconcileReviewRecordings(h.env, 40_000);
		expect(h.content.text(readyKey)).toBeNull();
		expect(h.row()).toMatchObject({ status: "failed" });
		expect(String(h.row().review_last_error)).toContain("record a new take");
	});

	it("slows attached polling to daily after 30 days and runs publications first", async () => {
		const h = await setup();
		await h.mark({}, false);
		h.setRow("review_state = 'attached', review_adoption_id = 'adoption-1', review_attached_at = 0, review_next_attempt_at = NULL");
		h.replies.push(summary("attached", { revisionId: "revision-1" }));
		const now = 31 * 86400;
		expect(await requestReviewAdoption(h.env, recordingId, { now })).toEqual({ status: "attached" });
		expect(h.row().review_next_attempt_at).toBe(now + 86400);
		const second = "recording-2";
		const secondKey = `studio/recordings/session-1/${second}/source.webm`;
		h.content.set(secondKey, "y".repeat(10), "source-etag-2");
		await markStudioRecordingReady(h.env, operator, { recordingId: second, sessionId: "session-1", sourceEtag: "source-etag-2", sourceFormat: "webm", sourceKey: secondKey });
		h.setRow("review_next_attempt_at = 0");
		h.d1.sqlite.prepare("UPDATE studio_recordings SET review_next_attempt_at = 5 WHERE recording_id = ?").run(second);
		const results = await reconcileReviewRecordings(h.env, now + 1, 1);
		expect(results.map((result) => result.recordingId)).toEqual([second]);
	});

	it("is a no-op without the binding, URL or secret", async () => {
		const h = await setup({ payload: false });
		await h.mark();
		await Promise.all(h.deferred);
		expect(await requestReviewAdoption(h.env, recordingId)).toEqual({ status: "not-configured" });
		expect(await reconcileReviewRecordings(h.env)).toEqual([]);
		expect(h.row()).toMatchObject({ review_state: "pending", review_attempts: 0 });
		const noSecret = { ...h.env, PAYLOAD: { fetch: vi.fn() } as unknown as Fetcher, PAYLOAD_HANDOFF_URL: "https://admin.rawkode.academy/api/studio-handoff/adoptions" };
		expect(await requestReviewAdoption(noSecret, recordingId)).toEqual({ status: "not-configured" });
	});
});

describe("Studio keeps working when Payload is down", () => {
	it("returns from recording-ready while Payload hangs, then backs off after the timeout", async () => {
		const h = await setup();
		h.replies.push("hang");
		const marker = await h.mark();
		expect(marker.readyMarkerKey).toBe(readyKey);
		expect(h.row()).toMatchObject({ status: "ready", review_state: "pending" });
		// The deferred handoff is still waiting on Payload; the response did not.
		const settled = vi.fn();
		void h.deferred[0]!.then(settled);
		await vi.waitFor(() => expect(h.requests).toHaveLength(1));
		expect(settled).not.toHaveBeenCalled();
		// A hung Payload is cut off by the request timeout and retried later.
		h.setRow("review_next_attempt_at = NULL");
		h.replies.push("hang");
		expect(await requestReviewAdoption(h.env, recordingId, { now: 10_000, timeoutMs: 20 })).toEqual({ status: "retrying" });
		expect(String(h.row().review_last_error)).toContain("Payload unreachable");
	});

	it("returns normally when Payload answers 5xx or the deferred call rejects", async () => {
		const h = await setup();
		h.replies.push(new Response("down", { status: 503 }));
		await expect(h.mark()).resolves.toMatchObject({ visibility: "review" });
		await Promise.all(h.deferred);
		expect(h.row()).toMatchObject({ review_attempts: 1, review_state: "pending" });
		// A defer whose promise rejects never surfaces to the caller.
		const h2 = await setup();
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		h2.env.STUDIO_MACHINE_SECRET = { get: async () => { throw new Error("secret store down"); } };
		const results: Promise<unknown>[] = [];
		await expect(markStudioRecordingReady(h2.env, operator, { recordingId, sessionId: "session-1", sourceEtag: "source-etag-1", sourceFormat: "webm", sourceKey }, { defer: (promise) => results.push(promise) })).resolves.toBeTruthy();
		await expect(Promise.all(results)).resolves.toBeTruthy();
	});

	it("creates sessions and publishes public recordings without ever calling Payload", async () => {
		const h = await setup({ reviewRequired: false });
		const fetch = vi.fn(async () => { throw new Error("Payload is down"); });
		const env = { ...h.env, PAYLOAD: { fetch } as unknown as Fetcher };
		const created = await createStudioSession(env, operator, { show: "Rawkode Live", title: "Outage drill", streamEnvironment: "test", reviewRequired: false });
		expect(created.session.reviewRequired).toBe(false);
		const marker = await markStudioRecordingReady(env, operator, { recordingId, sessionId: "session-1", sourceEtag: "source-etag-1", sourceFormat: "webm", sourceKey }, { defer: () => { throw new Error("must not defer a public recording"); } });
		expect(marker).toMatchObject({ contractVersion: 1, outputPrefix: "videos/video-1/" });
		expect(h.content.text(readyKey)).toBe(JSON.stringify(createReadyMarker({ videoId: "video-1", studioSessionId: "session-1", recordingId, sourceBucket: "rawkode-academy-content", sourceKey, sourceEtag: "source-etag-1", sourceFormat: "webm" }), null, 2));
		expect(fetch).not.toHaveBeenCalled();
	});
});
