import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { capture, flush, resetForTests, track } from "@/lib/analytics/track";
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

	it("flushes immediately once a batch is full", () => {
		for (let i = 0; i < 50; i++) track("seek");
		expect(fetchMock).toHaveBeenCalledTimes(1);
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

	it("capture() still reaches Basin when PostHog is blocked", () => {
		capture("cta_clicked");
		flush();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe("POST /api/e", () => {
	const analytics = { fetch: vi.fn() };
	const testEnv = env as unknown as Record<string, unknown>;

	beforeEach(() => {
		analytics.fetch.mockResolvedValue(Response.json({ success: true }));
		testEnv.ANALYTICS = analytics;
	});

	afterEach(() => {
		delete testEnv.ANALYTICS;
	});

	function call(body: unknown, headers: Record<string, string> = {}) {
		const url = new URL("https://rawkode.academy/api/e");
		// happy-dom's Request drops the forbidden `origin` header, so stub it.
		const all: Record<string, string> = {
			"content-type": "application/json",
			"user-agent": "Mozilla/5.0 Chrome/130.0",
			...headers,
		};
		const request = {
			headers: { get: (name: string) => all[name.toLowerCase()] ?? null },
			json: async () => body,
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
		const [url, init] = analytics.fetch.mock.calls[0] ?? [];
		expect(url).toBe("https://analytics.internal/ingest");
		const forwarded = JSON.parse((init as RequestInit).body as string);
		expect(forwarded.events).toHaveLength(1);
		expect(forwarded.context).toMatchObject({
			user_id: "user-1",
			user_agent: "Mozilla/5.0 Chrome/130.0",
		});
	});

	it("rejects other origins", async () => {
		const response = await call(
			{ events: [{ event_id: "e1", event: "x" }] },
			{ origin: "https://evil.example" },
		);
		expect(response.status).toBe(403);
		expect(analytics.fetch).not.toHaveBeenCalled();
	});

	it("rejects a malformed envelope", async () => {
		expect((await call({ nope: true })).status).toBe(400);
		expect((await call({ events: [] })).status).toBe(400);
	});

	it("caps a batch at 50 events", async () => {
		const events = Array.from({ length: 80 }, (_, i) => ({
			event_id: `e${i}`,
			event: "seek",
		}));
		await call({ events });
		const init = analytics.fetch.mock.calls[0]?.[1] as RequestInit;
		expect(JSON.parse(init.body as string).events).toHaveLength(50);
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
