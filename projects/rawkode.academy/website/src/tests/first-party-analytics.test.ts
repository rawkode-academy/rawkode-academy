import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	capture,
	flush,
	resetForTests,
	resetIdentity,
	track,
} from "@/lib/analytics/track";
import { clearCampaignAttribution } from "@/lib/analytics/attribution-cookies";
import { isPrefetch } from "@/lib/auth/prefetch";
import { POST } from "@/pages/api/e";

type Sent = { events: Array<Record<string, unknown>> };

function sentBatches(fetchMock: ReturnType<typeof vi.fn>): Sent[] {
	return fetchMock.mock.calls.map(
		([, init]) => JSON.parse((init as RequestInit).body as string) as Sent,
	);
}

describe("track()", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.useFakeTimers();
		resetForTests();
		clearCampaignAttribution();
		sessionStorage.clear();
		fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetchMock);
		Object.defineProperty(navigator, "doNotTrack", {
			value: null,
			configurable: true,
		});
		document.cookie = "rk_aid=; max-age=0; path=/";
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		delete (window as unknown as { posthog?: unknown }).posthog;
	});

	it("batches events and posts them to /api/e", () => {
		track("page_view", { title: "Home" });
		track("video_play", { video_id: "v1" });
		expect(fetchMock).not.toHaveBeenCalled();

		vi.advanceTimersByTime(2000);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/e");
		const [batch] = sentBatches(fetchMock);
		expect(batch?.events.map((e) => e.event)).toEqual([
			"page_view",
			"video_play",
		]);
		expect(batch?.events[0]).toMatchObject({
			properties: { title: "Home" },
			url: location.href,
		});
	});

	it("reads an existing first-party cookie after other cookies", () => {
		const cookies = vi
			.spyOn(document, "cookie", "get")
			.mockReturnValue("other=value; rk_aid=existing-id");
		try {
			track("page_view");
			flush();
			expect(sentBatches(fetchMock)[0]?.events[0]?.anonymous_id).toBe(
				"existing-id",
			);
		} finally {
			cookies.mockRestore();
		}
	});

	it("keeps one anonymous id and one session across events", () => {
		track("a");
		track("b");
		flush();
		const [batch] = sentBatches(fetchMock);
		const [first, second] = batch?.events ?? [];
		expect(first?.anonymous_id).toBeTruthy();
		expect(first?.anonymous_id).toBe(second?.anonymous_id);
		expect(first?.session_id).toBe(second?.session_id);
		expect(document.cookie).toContain(`rk_aid=${first?.anonymous_id}`);
	});

	it("splits batches by size so none exceeds the 64 KiB endpoint limit", () => {
		for (let i = 0; i < 40; i++)
			track("$exception", { stack: "x".repeat(3000) });
		flush();
		const bodies = fetchMock.mock.calls.map(
			([, init]) => (init as RequestInit).body as string,
		);
		expect(bodies.length).toBeGreaterThan(1);
		for (const body of bodies) {
			expect(new TextEncoder().encode(body).byteLength).toBeLessThan(64 * 1024);
		}
		const sent = sentBatches(fetchMock).flatMap((batch) => batch.events);
		expect(sent).toHaveLength(40);
	});

	it("keeps an oversized event but drops its properties", () => {
		track("page_view");
		track("$exception", { stack: "x".repeat(20_000) });
		flush();
		const [batch] = sentBatches(fetchMock);
		expect(batch?.events.map((e) => e.event)).toEqual([
			"page_view",
			"$exception",
		]);
		expect(batch?.events[1]?.properties).toMatchObject({
			_truncated: true,
			keys: expect.arrayContaining(["stack"]),
		});
	});

	it("flushes immediately once a batch is full", () => {
		for (let i = 0; i < 50; i++) track("seek");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("sends at once when the page is already hidden", () => {
		// web-vitals reports final CLS/INP after visibilitychange.
		const hidden = vi
			.spyOn(document, "visibilityState", "get")
			.mockReturnValue("hidden");
		const beacon = vi.fn().mockReturnValue(true);
		Object.defineProperty(navigator, "sendBeacon", {
			value: beacon,
			configurable: true,
		});
		try {
			track("web_vitals", { name: "CLS" });
			expect(beacon).toHaveBeenCalledTimes(1);
			expect(beacon.mock.calls[0]?.[0]).toBe("/api/e");
		} finally {
			hidden.mockRestore();
			delete (navigator as { sendBeacon?: unknown }).sendBeacon;
		}
	});

	it("respects Do Not Track, as posthog-js is configured to", () => {
		Object.defineProperty(navigator, "doNotTrack", {
			value: "1",
			configurable: true,
		});
		track("page_view");
		flush();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("capture() sends to PostHog and Basin", () => {
		const posthog = { capture: vi.fn() };
		(window as unknown as { posthog?: unknown }).posthog = posthog;

		capture("cta_clicked", { cta: "book" });
		flush();

		expect(posthog.capture).toHaveBeenCalledWith("cta_clicked", {
			cta: "book",
		});
		expect(sentBatches(fetchMock)[0]?.events[0]?.event).toBe("cta_clicked");
	});

	it("retries retryable responses with the original event ID", async () => {
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
		track("page_view");
		flush();
		await vi.advanceTimersByTimeAsync(1000);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		const batches = sentBatches(fetchMock);
		expect(batches[1]?.events).toEqual(batches[0]?.events);
	});

	it("clears first-party identity and stale retries on sign-out", async () => {
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
		track("page_view");
		flush();
		const old = sentBatches(fetchMock)[0]?.events[0]?.anonymous_id;
		resetIdentity();
		await vi.advanceTimersByTimeAsync(5000);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		track("page_view");
		flush();
		expect(sentBatches(fetchMock)[1]?.events[0]?.anonymous_id).not.toBe(old);
	});

	it("capture() still reaches Basin when PostHog is blocked", () => {
		capture("cta_clicked");
		flush();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe("POST /api/e", () => {
	const analytics = { ingestWebEvents: vi.fn() };
	const testEnv = env as unknown as Record<string, unknown>;

	beforeEach(() => {
		analytics.ingestWebEvents.mockReset().mockResolvedValue(1);
		testEnv.ANALYTICS = analytics;
	});

	afterEach(() => {
		delete testEnv.ANALYTICS;
	});

	async function call(body: unknown, headers: Record<string, string> = {}) {
		const url = new URL("https://rawkode.academy/api/e");
		// happy-dom's Request drops the forbidden `origin` header, so stub it.
		const all: Record<string, string> = {
			"content-type": "application/json",
			"user-agent": "Mozilla/5.0 Chrome/130.0",
			...headers,
		};
		const request = {
			headers: { get: (name: string) => all[name.toLowerCase()] ?? null },
			body: new ReadableStream({
				start(controller) {
					controller.enqueue(
						new TextEncoder().encode(
							typeof body === "string" ? body : JSON.stringify(body),
						),
					);
					controller.close();
				},
			}),
		};
		return POST({
			request,
			url,
			locals: { user: { id: "user-1" } },
		} as unknown as Parameters<typeof POST>[0]);
	}

	it("forwards events with server-side request context", async () => {
		const response = await call(
			{ events: [{ event_id: "e1", event: "page_view" }] },
			{ origin: "https://rawkode.academy" },
		);

		expect(response.status).toBe(204);
		const [events, context] = analytics.ingestWebEvents.mock.calls[0] ?? [];
		expect(events).toHaveLength(1);
		expect(context).toMatchObject({
			user_id: "user-1",
			url_origin: "https://rawkode.academy",
			user_agent: "Mozilla/5.0 Chrome/130.0",
		});
	});

	it("returns a retryable failure when durable ingestion fails or is unbound", async () => {
		analytics.ingestWebEvents.mockRejectedValueOnce(new Error("unavailable"));
		expect((await call({ events: [{}] })).status).toBe(503);
		delete testEnv.ANALYTICS;
		expect((await call({ events: [{}] })).status).toBe(503);
	});

	it("honours DNT on the server before ingestion", async () => {
		expect((await call({ events: [{}] }, { dnt: "1" })).status).toBe(204);
		expect(analytics.ingestWebEvents).not.toHaveBeenCalled();
	});

	it("waits for durable acceptance before acknowledging", async () => {
		let accept!: (value: number) => void;
		analytics.ingestWebEvents.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					accept = resolve;
				}),
		);
		let acknowledged = false;
		const response = call({ events: [{}] }).then((value) => {
			acknowledged = true;
			return value;
		});
		await vi.waitFor(() => expect(accept).toBeTypeOf("function"));
		expect(acknowledged).toBe(false);
		accept(1);
		expect((await response).status).toBe(204);
	});

	it("rejects other origins", async () => {
		const response = await call(
			{ events: [{ event_id: "e1", event: "x" }] },
			{ origin: "https://evil.example" },
		);
		expect(response.status).toBe(403);
		expect(analytics.ingestWebEvents).not.toHaveBeenCalled();
	});

	it("rejects a malformed envelope", async () => {
		expect((await call({ nope: true })).status).toBe(400);
		expect((await call({ events: [] })).status).toBe(400);
	});

	it("rejects an oversized body without a Content-Length", async () => {
		const response = await call("x".repeat(64 * 1024 + 1));
		expect(response.status).toBe(413);
		expect(analytics.ingestWebEvents).not.toHaveBeenCalled();
	});

	it("rejects oversized batches instead of silently dropping events", async () => {
		const events = Array.from({ length: 80 }, (_, i) => ({
			event_id: `e${i}`,
			event: "seek",
		}));
		expect((await call({ events })).status).toBe(400);
		expect(analytics.ingestWebEvents).not.toHaveBeenCalled();
	});
});

describe("isPrefetch", () => {
	// happy-dom's Request drops forbidden `sec-*` headers, so stub them.
	const request = (headers: Record<string, string>) =>
		({
			headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
		}) as unknown as Request;

	it("treats a top-level navigation as a real sign-in", () => {
		expect(isPrefetch(request({ "sec-fetch-mode": "navigate" }))).toBe(false);
		expect(isPrefetch(request({}))).toBe(false);
	});

	it("catches link prefetches and speculation rules", () => {
		expect(isPrefetch(request({ "sec-purpose": "prefetch" }))).toBe(true);
		expect(isPrefetch(request({ "sec-purpose": "prefetch;prerender" }))).toBe(
			true,
		);
		expect(isPrefetch(request({ purpose: "prefetch" }))).toBe(true);
		expect(isPrefetch(request({ "x-moz": "prefetch" }))).toBe(true);
	});

	it("catches Astro's fetch() prefetch fallback", () => {
		expect(isPrefetch(request({ "sec-fetch-mode": "cors" }))).toBe(true);
		expect(isPrefetch(request({ "sec-fetch-mode": "no-cors" }))).toBe(true);
	});
});
