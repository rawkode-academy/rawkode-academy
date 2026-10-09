import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioEnv, StudioUser } from "../env";
import { canonicalQuery, canonicalRequest, sha256Hex } from "./machine-auth";
import { confirmStudioStream, endStudioSession, startStudioStream, stopStudioStream } from "./operations";
import {
	broadcastBackoffSeconds,
	broadcastClaimLeaseSeconds,
	maxBroadcastAttempts,
	PAYLOAD_BROADCAST_PATH,
	queueBroadcastEvent,
	reconcileBroadcastEvents,
	sendBroadcastEvent,
} from "./payload-broadcast";
import { buildStudioSession, getStudioSession, saveStudioSession } from "./studio";
import { createSqliteD1 } from "./testing/doubles";

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
type Reply = Response | Error | "hang";

function stubStream() {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
			Response.json({
				success: true,
				result: init?.method === "POST"
					? {
						uid: "live-input-1",
						status: "new_configuration_accepted",
						webRTC: { url: "https://stream.example/webRTC/publish" },
						webRTCPlayback: { url: "https://stream.example/webRTC/play" },
					}
					: { uid: "live-input-1", status: "connected", webRTCPlayback: { url: "https://stream.example/webRTC/play" } },
			})),
	);
}

async function setup(options: { payload?: boolean; environment?: "prod" | "test"; contentVideoId?: string | null } = {}) {
	const d1 = createSqliteD1();
	const requests: Request[] = [];
	const bodies: string[] = [];
	const replies: Reply[] = [];
	const fetcher = {
		async fetch(request: Request) {
			requests.push(request);
			bodies.push(await request.clone().text());
			const reply = replies.shift() ?? Response.json({ ok: true });
			if (reply === "hang") {
				return await new Promise<Response>((_, reject) => {
					request.signal.addEventListener("abort", () => reject(request.signal.reason));
				});
			}
			if (reply instanceof Error) throw reply;
			return reply;
		},
	} as unknown as Fetcher;
	const env = {
		STUDIO_DB: d1.db,
		STUDIO_OPERATOR_GITHUB_HANDLES: "rawkode",
		CLOUDFLARE_ACCOUNT_ID: "account-1",
		CLOUDFLARE_STREAM_API_TOKEN: "stream-token",
		STREAM_NOTIFICATIONS: { send: vi.fn(async () => undefined) },
		...(options.payload === false
			? {}
			: {
				PAYLOAD: fetcher,
				PAYLOAD_HANDOFF_URL: "https://admin.rawkode.academy/api/studio-handoff/adoptions",
				STUDIO_MACHINE_SECRET: { get: async () => secret },
			}),
	} as unknown as StudioEnv;
	const contentVideoId = options.contentVideoId === undefined ? "video-1" : options.contentVideoId;
	await saveStudioSession(env, buildStudioSession({
		contentVideoId,
		contentVideoSlug: contentVideoId ? "video-1-slug" : null,
		createdBy: operator,
		meeting: null,
		sessionId: "session-1",
		show: "Rawkode Live",
		startsAt: new Date(Date.now() + 3600_000).toISOString(),
		streamEnvironment: options.environment ?? "prod",
		title: "Live show",
	}));
	const deferred: Promise<unknown>[] = [];
	const defer = { defer: (promise: Promise<unknown>) => deferred.push(promise) };
	const events = () => d1.sqlite.prepare("SELECT * FROM studio_broadcast_events ORDER BY rowid").all() as Array<Record<string, unknown>>;
	const goLive = async () => {
		stubStream();
		const start = await startStudioStream(env, operator, { sessionId: "session-1" });
		return await confirmStudioStream(env, operator, { sessionId: "session-1", streamToken: start.streamToken }, defer);
	};
	return { d1, env, requests, bodies, replies, deferred, defer, events, goLive };
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("Studio broadcast times for Payload", () => {
	it("reports a production stream's start and end, signed and idempotent, without waiting on Payload", async () => {
		const h = await setup();
		await expect(h.goLive()).resolves.toMatchObject({ streamStatus: "live" });
		expect(h.requests).toHaveLength(0);
		expect(h.deferred).toHaveLength(1);
		await Promise.all(h.deferred);
		const session = await getStudioSession(h.env, "session-1");
		const startedAt = new Date(session!.streamStartedAt! * 1000).toISOString();
		const [event] = h.events();
		expect(event).toMatchObject({ action: "broadcast-started", content_video_id: "video-1", occurred_at: startedAt, state: "sent" });
		const request = h.requests[0]!;
		expect(request.method).toBe("POST");
		expect(request.url).toBe(`https://admin.rawkode.academy${PAYLOAD_BROADCAST_PATH}`);
		expect(request.headers.get("cookie")).toBeNull();
		const body = JSON.parse(h.bodies[0]!);
		expect(body).toEqual({ action: "broadcast-started", legacyId: "video-1", commandId: event!.id, at: startedAt });
		expect(request.headers.get("idempotency-key")).toBe(body.commandId);
		const canonical = canonicalRequest({
			method: "POST",
			path: PAYLOAD_BROADCAST_PATH,
			query: canonicalQuery(""),
			principal: "rawkode-studio",
			timestamp: Number(request.headers.get("x-rawkode-timestamp")),
			idempotencyKey: body.commandId,
			bodySha256: await sha256Hex(h.bodies[0]!),
		});
		const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
		const signature = new Uint8Array(request.headers.get("x-rawkode-signature")!.slice(3).match(/../g)!.map((pair) => parseInt(pair, 16)));
		expect(await crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(canonical))).toBe(true);

		// Confirming again is a no-op: the (session, action, time) key dedupes.
		await confirmStudioStream(h.env, operator, { sessionId: "session-1" }, h.defer);
		await Promise.all(h.deferred);
		expect(h.events()).toHaveLength(1);

		await stopStudioStream(h.env, operator, { sessionId: "session-1" }, h.defer);
		await Promise.all(h.deferred);
		expect(h.events().map((row) => [row.action, row.state])).toEqual([["broadcast-started", "sent"], ["broadcast-ended", "sent"]]);
		expect(JSON.parse(h.bodies.at(-1)!).action).toBe("broadcast-ended");
		// Ending the session after the stop reports nothing new.
		await endStudioSession(h.env, operator, { sessionId: "session-1" }, h.defer);
		expect(h.events()).toHaveLength(2);
	});

	it("keeps streaming while Payload hangs or fails, then the cron delivers in order", async () => {
		const h = await setup();
		h.replies.push("hang");
		await expect(h.goLive()).resolves.toMatchObject({ streamStatus: "live" });
		// The deferred send is still waiting on Payload; the live response did not.
		const settled = vi.fn();
		void h.deferred[0]!.then(settled);
		await vi.waitFor(() => expect(h.requests).toHaveLength(1));
		expect(settled).not.toHaveBeenCalled();
		await stopStudioStream(h.env, operator, { sessionId: "session-1" }, h.defer);
		await h.deferred[1];
		const [started, ended] = h.events();
		// The end waits behind its start, which the hung call still holds under lease.
		expect(started).toMatchObject({ state: "pending", attempts: 0 });
		expect(ended).toMatchObject({ state: "pending", attempts: 0 });
		expect(h.requests).toHaveLength(1);

		// After the lease, a hung Payload is cut off by the timeout and retried later.
		const now = Math.floor(Date.now() / 1000) + 121;
		h.replies.push("hang");
		await expect(sendBroadcastEvent(h.env, String(started!.id), { now, timeoutMs: 20 })).resolves.toEqual({ status: "retrying" });
		expect(h.events()[0]).toMatchObject({ state: "pending", attempts: 1, next_attempt_at: now + broadcastBackoffSeconds[0] });
		expect(String(h.events()[0]!.last_error)).toContain("Payload unreachable");
		h.replies.push(new Response("Unavailable", { status: 503 }));
		const later = now + broadcastBackoffSeconds[0];
		await reconcileBroadcastEvents(h.env, later);
		expect(h.events()[0]).toMatchObject({ state: "pending", attempts: 2, next_attempt_at: later + broadcastBackoffSeconds[1] });
		const results = await reconcileBroadcastEvents(h.env, later + broadcastBackoffSeconds[1]);
		expect(results.map((result) => result.result.status)).toEqual(["sent", "sent"]);
		expect(h.bodies.slice(-2).map((body) => JSON.parse(body).action)).toEqual(["broadcast-started", "broadcast-ended"]);
	});

	it("treats 400 and 409 as final, retries 404 and gives up after the attempt cap", async () => {
		const h = await setup();
		const session = (await getStudioSession(h.env, "session-1"))!;
		const at = Math.floor(Date.now() / 1000);
		const id = (await queueBroadcastEvent(h.env, { ...session, streamStartedAt: at }, "broadcast-started"))!;
		h.replies.push(Response.json({ error: "The broadcast already started" }, { status: 409 }));
		await expect(sendBroadcastEvent(h.env, id, { now: at })).resolves.toEqual({ status: "rejected" });
		expect(h.events()[0]).toMatchObject({ state: "rejected", next_attempt_at: null });
		expect(String(h.events()[0]!.last_error)).toContain("Payload 409");

		const second = (await queueBroadcastEvent(h.env, { ...session, streamStartedAt: at + 60 }, "broadcast-started"))!;
		let now = at;
		for (let attempt = 1; attempt < maxBroadcastAttempts; attempt += 1) {
			h.replies.push(new Response("No Payload video has this legacy ID", { status: 404 }));
			await expect(sendBroadcastEvent(h.env, second, { now })).resolves.toEqual({ status: "retrying" });
			now += broadcastBackoffSeconds.at(-1)!;
		}
		h.replies.push(new Response("Not found", { status: 404 }));
		await expect(sendBroadcastEvent(h.env, second, { now })).resolves.toEqual({ status: "rejected" });
		expect(String(h.events()[1]!.last_error)).toContain("gave up");
	});

	it("keeps every retry inside Payload's 24 hour window for a broadcast start", () => {
		let elapsed = 0;
		for (let attempt = 1; attempt < maxBroadcastAttempts; attempt += 1) {
			elapsed += broadcastBackoffSeconds[Math.min(attempt - 1, broadcastBackoffSeconds.length - 1)];
		}
		expect(elapsed).toBeLessThan(24 * 3600 - broadcastClaimLeaseSeconds);
	});

	it("backfills events whose outbox write was lost, from the cron", async () => {
		const h = await setup();
		await h.goLive();
		await Promise.all(h.deferred);
		await stopStudioStream(h.env, operator, { sessionId: "session-1" });
		h.d1.sqlite.exec("DELETE FROM studio_broadcast_events");
		const results = await reconcileBroadcastEvents(h.env);
		expect(results.map((result) => result.result.status)).toEqual(["sent", "sent"]);
		expect(h.events().map((event) => [event.action, event.state])).toEqual([["broadcast-started", "sent"], ["broadcast-ended", "sent"]]);
		// Already reported: the next run queues nothing.
		await expect(reconcileBroadcastEvents(h.env)).resolves.toEqual([]);
		// Sessions older than Payload's window are left to staff.
		h.d1.sqlite.exec("DELETE FROM studio_broadcast_events");
		await expect(reconcileBroadcastEvents(h.env, Math.floor(Date.now() / 1000) + 24 * 3600)).resolves.toEqual([]);
	});

	it("re-queues a lost start when a live stream is confirmed again", async () => {
		const h = await setup();
		await h.goLive();
		await Promise.all(h.deferred);
		h.d1.sqlite.exec("DELETE FROM studio_broadcast_events");
		await confirmStudioStream(h.env, operator, { sessionId: "session-1" }, h.defer);
		await Promise.all(h.deferred);
		expect(h.events().map((event) => [event.action, event.state])).toEqual([["broadcast-started", "sent"]]);
	});

	it("reports nothing for test streams, sessions without a content video, unconfigured Payload, or an end without a start", async () => {
		for (const options of [{ environment: "test" as const }, { contentVideoId: null }, { payload: false }]) {
			const h = await setup(options);
			if (options.contentVideoId === null) {
				// A standalone prod show needs no content video to go live.
				stubStream();
				const start = await startStudioStream(h.env, operator, { sessionId: "session-1" });
				await confirmStudioStream(h.env, operator, { sessionId: "session-1", streamToken: start.streamToken }, h.defer);
			} else {
				await h.goLive();
			}
			await stopStudioStream(h.env, operator, { sessionId: "session-1" }, h.defer);
			expect(h.events()).toEqual([]);
			expect(h.requests).toHaveLength(0);
		}
		const h = await setup();
		const session = (await getStudioSession(h.env, "session-1"))!;
		await expect(queueBroadcastEvent(h.env, { ...session, streamEndedAt: Math.floor(Date.now() / 1000) }, "broadcast-ended")).resolves.toBeNull();
		expect(h.events()).toEqual([]);
	});
});
