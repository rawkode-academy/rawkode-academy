import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	computeContentCache,
	DEFAULT_MAX_AGE,
	DEFAULT_SWR,
	fitTags,
	contentCacheMiddleware,
	disableContentCache,
	SETTLING_MAX_AGE,
	STALE_MAX_AGE,
	setContentCache,
} from "@/lib/live-content/cache-control";
import {
	guardSharedCache,
	hasPersonalisingCookie,
} from "@/lib/live-content/personalisation";
import { LIST_QUERIES } from "@/lib/live-content/queries";
import { setContentEnv } from "@/lib/live-content/env";
import {
	GENERATION_KEY,
	resetContentCacheForTests,
} from "@/lib/live-content/kv-cache";
import { memoryKv } from "./memory-kv";

const NOW = Date.parse("2026-10-23T12:00:00Z");
const ctx = (
	over: Partial<Parameters<typeof computeContentCache>[1]> = {},
) => ({
	now: NOW,
	nextPublishAt: [],
	generationBumpedAt: 0,
	...over,
});
const entry = (
	collection: string,
	id: string,
	publishedAt: Date,
	extra: string[] = [],
) => ({
	collection,
	data: { publishedAt },
	cacheHint: {
		tags: [collection, `${collection}:${id}`, ...extra],
		lastModified: publishedAt,
	},
});

describe("schedule-aware maxAge", () => {
	it("defaults to an hour with a day of stale-while-revalidate", () => {
		const result = computeContentCache(
			{ entries: [entry("articles", "a", new Date(NOW - 1000))] },
			ctx(),
		);
		expect(result).toMatchObject({ maxAge: DEFAULT_MAX_AGE, swr: DEFAULT_SWR });
		expect(result.cappedBy).toBeUndefined();
		expect(result.tags).toEqual(["articles", "articles:a"]);
		expect(result.lastModified).toEqual(new Date(NOW - 1000));
	});

	it("caps maxAge at the seconds until the next scheduled item of a listed collection, without swr", () => {
		const result = computeContentCache(
			{ collections: ["news"] },
			ctx({ nextPublishAt: [NOW + 90_500] }),
		);
		expect(result).toMatchObject({ maxAge: 91, swr: 0, cappedBy: "schedule" });
		expect(result.tags).toEqual(["news"]);
	});

	it("uses the earliest of several collections and ignores past or missing times", () => {
		const result = computeContentCache(
			{ collections: ["news", "videos", "articles"] },
			ctx({ nextPublishAt: [undefined, NOW + 600_000, NOW - 5] }),
		);
		expect(result.maxAge).toBe(600);
	});

	it("caps at a future-dated entry on the page (an upcoming stream)", () => {
		const result = computeContentCache(
			{ entries: [entry("videos", "live", new Date(NOW + 120_000))] },
			ctx(),
		);
		expect(result).toMatchObject({ maxAge: 120, swr: 0 });
	});

	it("keeps maxAge but ends the stale window at the next item when it is further away than maxAge", () => {
		const result = computeContentCache(
			{ collections: ["news"] },
			ctx({ nextPublishAt: [NOW + 7_200_000] }),
		);
		// A request after the publication instant must never get the cached
		// pre-publication page, not even as a stale response.
		expect(result).toMatchObject({
			maxAge: DEFAULT_MAX_AGE,
			swr: 7_200 - DEFAULT_MAX_AGE,
			cappedBy: "schedule",
		});
		expect(result.maxAge + result.swr).toBeLessThanOrEqual(7_200);
	});

	it("keeps the full stale window when the next item is beyond maxAge + swr", () => {
		const result = computeContentCache(
			{ collections: ["news"] },
			ctx({
				nextPublishAt: [NOW + (DEFAULT_MAX_AGE + DEFAULT_SWR + 60) * 1000],
			}),
		);
		expect(result).toMatchObject({ maxAge: DEFAULT_MAX_AGE, swr: DEFAULT_SWR });
		expect(result.cappedBy).toBeUndefined();
	});

	it("caches briefly without swr when content came from the last-good fallback", () => {
		expect(computeContentCache({}, ctx({ stale: true }))).toMatchObject({
			maxAge: STALE_MAX_AGE,
			swr: 0,
			cappedBy: "stale",
		});
	});

	it("never goes below one second", () => {
		expect(
			computeContentCache(
				{ collections: ["news"] },
				ctx({ nextPublishAt: [NOW + 1] }),
			).maxAge,
		).toBe(1);
	});

	it("caches briefly right after an invalidation", () => {
		const result = computeContentCache(
			{},
			ctx({ generationBumpedAt: NOW - 30_000 }),
		);
		expect(result).toMatchObject({
			maxAge: SETTLING_MAX_AGE,
			cappedBy: "settling",
		});
		expect(
			computeContentCache({}, ctx({ generationBumpedAt: NOW - 600_000 }))
				.maxAge,
		).toBe(DEFAULT_MAX_AGE);
	});

	it("honours a smaller explicit maxAge", () => {
		expect(
			computeContentCache(
				{ maxAge: 60, swr: 10 },
				ctx({ nextPublishAt: [NOW + 300_000] }),
			),
		).toMatchObject({
			maxAge: 60,
			swr: 10,
		});
	});
});

describe("tags", () => {
	it("merges entry hints, related tags, collections and extras without duplicates", () => {
		const result = computeContentCache(
			{
				entries: [
					entry("videos", "v1", new Date(NOW - 1), ["people:rawkode"]),
					entry("videos", "v2", new Date(NOW - 1), ["people:rawkode"]),
					undefined,
				],
				collections: ["videos"],
				tags: ["page:watch"],
			},
			ctx(),
		);
		expect(result.tags.sort()).toEqual(
			[
				"page:watch",
				"people:rawkode",
				"videos",
				"videos:v1",
				"videos:v2",
			].sort(),
		);
	});

	it("folds entity tags into collection tags when the header would be too large", () => {
		const tags = Array.from(
			{ length: 600 },
			(_, i) => `videos:${"x".repeat(20)}${i}`,
		);
		expect(fitTags(["videos", ...tags, "people:rawkode"], 8000).sort()).toEqual(
			["people", "videos"],
		);
		expect(fitTags(["a", "b", "a"])).toEqual(["a", "b"]);
		// Non-collection tags are kept: purging "page:home" must still hit.
		expect(fitTags([...tags, "page:home"], 8000).sort()).toEqual([
			"page:home",
			"videos",
		]);
	});
});

describe("setContentCache", () => {
	beforeEach(() => {
		resetContentCacheForTests(() => NOW);
	});
	afterEach(() => setContentEnv(undefined));

	function astro(locals: Record<string | symbol, unknown> = {}) {
		const set = vi.fn();
		return { target: { cache: { enabled: true, set }, locals }, set };
	}

	it("sets the merged options on Astro.cache and keeps the smallest maxAge across calls", async () => {
		setContentEnv({ CONTENT_CACHE: memoryKv() });
		const { target, set } = astro();
		await setContentCache(target, {
			entries: [entry("articles", "a", new Date(NOW - 1))],
		});
		expect(set).toHaveBeenLastCalledWith(
			expect.objectContaining({
				maxAge: DEFAULT_MAX_AGE,
				swr: DEFAULT_SWR,
				tags: ["articles", "articles:a"],
			}),
		);
		await setContentCache(target, {
			entries: [entry("videos", "soon", new Date(NOW + 30_000))],
		});
		const last = set.mock.calls.at(-1)![0];
		expect(last.maxAge).toBe(30);
		expect(last.swr).toBe(0);
		expect(last.tags.sort()).toEqual([
			"articles",
			"articles:a",
			"videos",
			"videos:soon",
		]);
	});

	it("caches briefly when a listed collection could not be loaded", async () => {
		// No gateway and nothing in KV: an optional section using this listing
		// rendered empty (optionalContent), so the page must not stick for an hour.
		setContentEnv({ CONTENT_CACHE: memoryKv() });
		const { target, set } = astro();
		const result = await setContentCache(target, {
			collections: ["testimonials"],
		});
		expect(result).toMatchObject({
			maxAge: STALE_MAX_AGE,
			swr: 0,
			cappedBy: "stale",
		});
		expect(set).toHaveBeenLastCalledWith(
			expect.objectContaining({ maxAge: STALE_MAX_AGE, swr: 0 }),
		);
	});

	it("applies the settling cap from the KV generation", async () => {
		setContentEnv({
			CONTENT_CACHE: memoryKv({
				[GENERATION_KEY]: JSON.stringify({
					generation: 3,
					bumpedAt: NOW - 10_000,
				}),
			}),
		});
		const { target, set } = astro();
		await setContentCache(target, {});
		expect(set.mock.calls[0]![0].maxAge).toBe(SETTLING_MAX_AGE);
	});

	it("does not cache pages rendered for a signed-in visitor", async () => {
		setContentEnv({ CONTENT_CACHE: memoryKv() });
		const { target, set } = astro({ user: { id: "u1" } });
		const result = await setContentCache(target, {});
		expect(set).not.toHaveBeenCalled();
		expect(result.skipped).toBe("personalised");
	});

	it("is a no-op when route caching is disabled (astro dev)", async () => {
		setContentEnv({ CONTENT_CACHE: memoryKv() });
		const set = vi.fn();
		await setContentCache({ cache: { enabled: false, set }, locals: {} }, {});
		expect(set).not.toHaveBeenCalled();
	});
});

describe("setContentCache against live collections", () => {
	let clock = NOW;
	beforeEach(() => {
		clock = NOW;
		resetContentCacheForTests(() => clock);
	});
	afterEach(() => setContentEnv(undefined));

	const article = (id: string, publishedAt: number) => ({
		id,
		title: id,
		description: id,
		publishedAt: new Date(publishedAt).toISOString(),
		body: { type: "doc", content: [{ type: "paragraph" }] },
		authors: [{ id: "rawkode" }],
		technologies: [],
	});

	function env(rows: unknown[] | (() => never)) {
		const spec = LIST_QUERIES.articles;
		return {
			CONTENT_CACHE: memoryKv(),
			API: {
				fetch: async () =>
					typeof rows === "function"
						? rows()
						: Response.json({ data: { [spec.root]: rows } }),
			},
		};
	}

	function target(locals: Record<string | symbol, unknown> = {}) {
		const set = vi.fn();
		return { t: { cache: { enabled: true, set }, locals }, set };
	}

	it("caps at the next scheduled item after the request time, not the one seen when the isolate mapped the collection", async () => {
		setContentEnv(
			env([
				article("published", NOW - 60_000),
				article("soon", NOW + 60_000),
				article("later", NOW + 1_800_000),
			]),
		);
		const first = target();
		await setContentCache(first.t, { collections: ["articles"] });
		expect(first.set.mock.calls[0]![0]).toMatchObject({ maxAge: 60, swr: 0 });

		// Two minutes later the mapped collection is still memoised; "soon" has
		// passed, so the page must still expire when "later" goes live.
		clock = NOW + 120_000;
		const second = target();
		await setContentCache(second.t, { collections: ["articles"] });
		expect(second.set.mock.calls[0]![0]).toMatchObject({
			maxAge: 1_680,
			swr: 0,
		});
	});

	it("caches only briefly when the gateway failed and the last-good copy was served", async () => {
		const kv = memoryKv();
		const spec = LIST_QUERIES.articles;
		let fail = false;
		setContentEnv({
			CONTENT_CACHE: kv,
			API: {
				fetch: async () => {
					if (fail) return new Response("down", { status: 503 });
					return Response.json({
						data: { [spec.root]: [article("a", NOW - 1000)] },
					});
				},
			},
		});
		const ok = target();
		await setContentCache(ok.t, { collections: ["articles"] });
		expect(ok.set.mock.calls[0]![0].maxAge).toBe(DEFAULT_MAX_AGE);

		// New generation, gateway down: the page renders from the last-good copy.
		fail = true;
		clock = NOW + 1_000_000;
		vi.spyOn(console, "warn").mockImplementation(() => {});
		resetContentCacheForTests(() => clock);
		kv.store.set(
			GENERATION_KEY,
			JSON.stringify({ generation: 9, bumpedAt: NOW - 3_600_000 }),
		);
		const degraded = target();
		await setContentCache(degraded.t, {
			entries: [
				{
					collection: "articles",
					data: { publishedAt: new Date(NOW - 1000) },
					cacheHint: { tags: ["articles", "articles:a"] },
				},
			],
		});
		expect(degraded.set.mock.calls[0]![0]).toMatchObject({
			maxAge: STALE_MAX_AGE,
			swr: 0,
		});
	});
});

// happy-dom's Request/Response drop the forbidden Cookie / Set-Cookie
// headers, so these tests use plain Headers (no guard) on minimal objects.
function fakeRequest(url: string, cookie?: string): Request {
	const headers = new Headers();
	if (cookie) headers.set("cookie", cookie);
	return { url, headers } as unknown as Request;
}
function fakeResponse(init: Record<string, string>, status = 200): Response {
	const headers = new Headers();
	for (const [k, v] of Object.entries(init)) headers.append(k, v);
	return { headers, body: null, status } as unknown as Response;
}

describe("personalised and late renders", () => {
	beforeEach(() => resetContentCacheForTests(() => NOW));
	afterEach(() => setContentEnv(undefined));

	const page = (
		cookie?: string,
		locals: Record<string | symbol, unknown> = {},
	) => {
		const set = vi.fn();
		const request = fakeRequest("https://rawkode.academy/read/x", cookie);
		return { t: { cache: { enabled: true, set }, locals, request }, set };
	};

	it("recognises cookies that server components personalise on", () => {
		expect(hasPersonalisingCookie("newsletter:academy:updates=true")).toBe(
			true,
		);
		expect(
			hasPersonalisingCookie("a=1; newsletter%3Aacademy%3Aupdates=true"),
		).toBe(true);
		expect(hasPersonalisingCookie("astro-session=abc")).toBe(true);
		expect(hasPersonalisingCookie("rawkode-session=abc")).toBe(true);
		expect(
			hasPersonalisingCookie("__Secure-better-auth.session_token=abc"),
		).toBe(true);
		expect(hasPersonalisingCookie("lead-magnet:k8s-1-35-cheatsheet=true")).toBe(
			true,
		);
		expect(hasPersonalisingCookie("ph_posthog=1; theme=dark")).toBe(false);
		expect(hasPersonalisingCookie("astro-session=")).toBe(false);
		expect(hasPersonalisingCookie(null)).toBe(false);
	});

	it("does not store a render for an anonymous visitor with a newsletter or session cookie", async () => {
		setContentEnv({ CONTENT_CACHE: memoryKv() });
		for (const cookie of [
			"newsletter:academy:updates=true",
			"astro-session=s1",
		]) {
			const { t, set } = page(cookie);
			const result = await setContentCache(t, {});
			expect(result.skipped, cookie).toBe("personalised");
			expect(set).not.toHaveBeenCalled();
		}
		const anonymous = page("theme=dark");
		await setContentCache(anonymous.t, {});
		expect(anonymous.set).toHaveBeenCalled();
	});

	it("keeps a page uncached after disableContentCache, even if setContentCache runs later", async () => {
		setContentEnv({ CONTENT_CACHE: memoryKv() });
		const { t, set } = page();
		disableContentCache(t);
		const result = await setContentCache(t, {});
		expect(set).toHaveBeenCalledTimes(1);
		expect(set).toHaveBeenCalledWith(false);
		expect(result.skipped).toBe("personalised");
	});

	it("warns and ignores calls made after the response headers were applied", async () => {
		setContentEnv({ CONTENT_CACHE: memoryKv() });
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { t, set } = page();
		await contentCacheMiddleware(t, async () => new Response("ok"));
		const result = await setContentCache(t, {});
		expect(result.skipped).toBe("late");
		expect(set).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("/read/x"));
	});
});

describe("guardSharedCache", () => {
	const cacheable = (headers: Record<string, string> = {}) =>
		fakeResponse({
			"Cloudflare-CDN-Cache-Control": "public, max-age=3600",
			"Cache-Tag": "articles",
			...headers,
		});

	it("never lets the CDN store a response that sets a cookie", () => {
		const res = guardSharedCache(
			fakeRequest("https://rawkode.academy/"),
			cacheable({ "set-cookie": "astro-session=abc; Path=/" }),
		);
		expect(res.headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
		expect(res.headers.has("Cache-Tag")).toBe(false);
	});

	it("never stores a render for a request with a personalising cookie", () => {
		const res = guardSharedCache(
			fakeRequest(
				"https://rawkode.academy/",
				"newsletter:academy:updates=true",
			),
			cacheable(),
		);
		expect(res.headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
	});

	it.each([
		404, 500, 502, 503,
	])("never lets the CDN store a %i error response", (status) => {
		const res = guardSharedCache(
			fakeRequest("https://rawkode.academy/read/missing"),
			fakeResponse(
				{
					"Cloudflare-CDN-Cache-Control":
						"public, max-age=3600, stale-while-revalidate=86400",
					"Cache-Tag": "articles,articles:missing",
				},
				status,
			),
		);
		expect(res.headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
		expect(res.headers.has("Cache-Tag")).toBe(false);
	});

	it("keeps redirects cacheable", () => {
		const res = guardSharedCache(
			fakeRequest("https://rawkode.academy/old"),
			fakeResponse(
				{ "Cloudflare-CDN-Cache-Control": "public, max-age=60" },
				301,
			),
		);
		expect(res.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
			"public, max-age=60",
		);
	});

	it("leaves anonymous cacheable and already uncacheable responses alone", () => {
		const res = guardSharedCache(
			fakeRequest("https://rawkode.academy/", "theme=dark"),
			cacheable(),
		);
		expect(res.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
			"public, max-age=3600",
		);
		const noStore = fakeResponse({
			"Cloudflare-CDN-Cache-Control": "no-store",
			"set-cookie": "a=b",
		});
		expect(
			guardSharedCache(fakeRequest("https://rawkode.academy/"), noStore),
		).toBe(noStore);
	});
});
