import type { APIContext } from "astro";
import { parseAtomFeed, parseRssFeed } from "feedsmith";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
	collections,
	getCollection,
	getEntries,
	getEntry,
	render,
	setContentCache,
} = vi.hoisted(() => ({
	collections: {} as Record<string, any[]>,
	getCollection: vi.fn(),
	getEntries: vi.fn(),
	getEntry: vi.fn(),
	render: vi.fn(),
	setContentCache: vi.fn(),
}));
// The collection boundary is the live content layer. Its wrappers hide
// scheduled stories on their own; the mock deliberately does not, so these
// contracts fail if a route drops its own publication filter.
vi.mock("@/lib/live-content", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/live-content")>()),
	getCollection,
	getEntries,
	getEntry,
	setContentCache,
	disableContentCache: vi.fn(),
}));

import { GET as newsRss } from "../pages/api/feeds/news.xml";
import { GET as newsAtom } from "../pages/api/feeds/news.atom";
import { GET as newsJson } from "../pages/api/feeds/news.json";
import { GET as allRss } from "../pages/api/feeds/all.xml";
import { GET as allAtom } from "../pages/api/feeds/all.atom";
import { GET as allJson } from "../pages/api/feeds/all.json";
import { GET as technologyFeed } from "../pages/api/feeds/technology/[id].xml";
import { GET as personRss } from "../pages/api/feeds/people/[id].xml";
import { GET as opml } from "../pages/feeds.opml";
import { GET as googleNews } from "../pages/news-sitemap.xml";
import {
	getNewsSitemapEntries,
	getFreshNewsSitemapEntries,
	selectFreshNewsItems,
	GOOGLE_NEWS_FRESHNESS_MS,
} from "../lib/sitemaps";
import { buildSearchIndex, searchEntries } from "../lib/search";

const now = new Date("2026-09-20T18:00:00Z");
const entry = (id: string, publishedAt: Date, data = {}) => ({
	id,
	data: {
		id,
		slug: id,
		name: id,
		title: `Discovery ${id}`,
		description: `About ${id}`,
		publishedAt,
		authors: ["reporter"],
		technologies: ["kubernetes"],
		guests: ["reporter"],
		categories: [],
		...data,
	},
});
const boundary = entry("boundary", now);
const past = entry("past", new Date(now.getTime() - 1000));
const future = entry("future", new Date(now.getTime() + 1));
const invalid = entry("invalid", new Date(Number.NaN));
const context = () =>
	({
		site: new URL("https://academy.test"),
		cache: { enabled: true, set: vi.fn() },
		locals: {},
		request: new Request("https://academy.test/"),
		params: { id: "reporter" },
		props: {
			technologyName: "Kubernetes",
			technologyRawId: "kubernetes",
			technologyIndexedId: "kubernetes/index",
		},
	}) as unknown as APIContext;

// The technology feed resolves its technology from the route param.
const technologyRss = (request: APIContext) =>
	technologyFeed({ ...request, params: { id: "kubernetes" } } as APIContext);

const feeds = [
	["News RSS", newsRss],
	["News Atom", newsAtom],
	["News JSON", newsJson],
	["All RSS", allRss],
	["All Atom", allAtom],
	["All JSON", allJson],
	["Technology RSS", technologyRss],
	["Person RSS", personRss],
] as const;

async function feedNewsPaths(
	handler: (context: APIContext) => Response | Promise<Response>,
) {
	const response = await handler(context());
	expect(response.status).toBe(200);
	const text = await response.text();
	let urls: string[];
	if (response.headers.get("Content-Type")?.includes("json")) {
		urls = JSON.parse(text).items.map((item: { url: string }) => item.url);
	} else if (response.headers.get("Content-Type")?.includes("atom")) {
		const feed = parseAtomFeed(text);
		expect(feed.title).toContain("Rawkode Academy");
		urls = (feed.entries ?? []).map(
			(item) =>
				item.links?.find((link) => link.rel === "alternate")?.href ?? "",
		);
	} else {
		const feed = parseRssFeed(text);
		expect(feed.title).toContain("Rawkode Academy");
		urls = (feed.items ?? []).map((item) => item.link ?? "");
	}
	return urls
		.map((url) => new URL(url).pathname.replace(/\/$/, ""))
		.filter((path) => path.startsWith("/news/"));
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
	for (const key of Object.keys(collections)) delete collections[key];
	collections.news = [future, invalid, past, boundary];
	collections.people = [entry("reporter", now)];
	collections.technologies = [entry("kubernetes", now, { name: "Kubernetes" })];
	getCollection.mockImplementation(async (name, filter) =>
		(collections[name] ?? []).filter(filter ?? (() => true)),
	);
	getEntries.mockImplementation(async (refs) =>
		refs.map((ref: string | { id: string }) =>
			entry(typeof ref === "string" ? ref : ref.id, now),
		),
	);
	getEntry.mockImplementation(
		async (
			collection: string | { collection: string; id: string },
			id?: unknown,
		) => {
			const [name, key] =
				typeof collection === "string"
					? [collection, id]
					: [collection.collection, collection.id];
			return (collections[name] ?? []).find((item) => item.id === key);
		},
	);
	render.mockResolvedValue({});
	setContentCache.mockReset();
	setContentCache.mockImplementation(async () => ({
		maxAge: 3600,
		swr: 86400,
		tags: [],
	}));
});
afterEach(() => {
	vi.useRealTimers();
	expect(fetch).not.toHaveBeenCalled();
});

describe("News discovery publication contracts", () => {
	it.each([
		["news", newsAtom],
		["all", allAtom],
	] as const)("%s Atom emits exact functional destinations without duplicate slashes", async (name, handler) => {
		for (const site of [
			new URL("https://academy.test"),
			new URL("https://academy.test/"),
			undefined,
		]) {
			const request = { ...context(), site } as APIContext;
			const base = site ? "https://academy.test" : "https://rawkode.academy";
			const feed = parseAtomFeed(await (await handler(request)).text());
			expect(feed.links?.find((link) => link.rel === "self")?.href).toBe(
				`${base}/api/feeds/${name}.atom`,
			);
			expect(feed.links?.find((link) => link.rel === "alternate")?.href).toBe(
				name === "news" ? `${base}/news` : base,
			);
			expect(feed.id).toBe(name === "news" ? `${base}/news` : `${base}/`);
			expect(feed.entries?.map((item) => item.id)).toEqual([
				`${base}/news/boundary/`,
				`${base}/news/past/`,
			]);
			expect(
				feed.entries?.map(
					(item) => item.links?.find((link) => link.rel === "alternate")?.href,
				),
			).toEqual([`${base}/news/boundary/`, `${base}/news/past/`]);
		}
	});
	it.each(
		feeds,
	)("%s excludes future/invalid News before serializing and keeps descending order", async (_name, handler) => {
		expect(await feedNewsPaths(handler)).toEqual([
			"/news/boundary",
			"/news/past",
		]);
	});

	it.each(
		feeds,
	)("%s remains valid when all News is unpublished", async (_name, handler) => {
		collections.news = [future, invalid];
		expect(await feedNewsPaths(handler)).toEqual([]);
	});

	// The technology feed lists published recordings only (upcoming streams
	// are filtered by the route); the site-wide feeds keep announcing them.
	it.each([
		["All RSS", allRss, true],
		["All Atom", allAtom, true],
		["All JSON", allJson, true],
		["Technology RSS", technologyRss, false],
	] as const)("%s includes articles regardless of the legacy flag and preserves News publication rules", async (_name, handler, listsUpcomingVideos) => {
		collections.articles = [
			entry("future-article", future.data.publishedAt),
			entry("draft-article", now, { draft: true }),
		];
		collections.videos = [entry("future-video", future.data.publishedAt)];
		const text = await (await handler(context())).text();
		expect(text).toContain("/read/future-article/");
		if (listsUpcomingVideos) expect(text).toContain("/watch/future-video/");
		else expect(text).not.toContain("/watch/future-video/");
		expect(text).toContain("/read/draft-article/");
		expect(text).not.toContain("/news/future/");
	});

	it("search indexes eligible News and articles regardless of the legacy draft flag", async () => {
		collections.articles = [
			entry("future-article", future.data.publishedAt),
			entry("draft-article", now, { draft: true }),
		];
		collections.videos = [entry("future-video", future.data.publishedAt)];
		const index = await buildSearchIndex();
		expect(
			searchEntries(index, "Discovery", ["news"]).map((item) => item.href),
		).toEqual(["/news/boundary", "/news/past"]);
		expect(index.map((item) => item.href)).toContain("/read/future-article");
		expect(index.map((item) => item.href)).toContain("/watch/future-video");
		expect(index.map((item) => item.href)).toContain("/read/draft-article");
	});

	it("regular News sitemap removes future/invalid URLs without applying the 48-hour limit", async () => {
		collections.news!.push(entry("old", new Date("2026-01-01")));
		expect((await getNewsSitemapEntries(now)).map((item) => item.path)).toEqual(
			["/news/boundary", "/news/old", "/news/past"],
		);
	});

	it("Google News uses inclusive 48-hour and publication bounds in both metadata and XML", async () => {
		const lower = entry(
			"lower",
			new Date(now.getTime() - GOOGLE_NEWS_FRESHNESS_MS),
		);
		const tooOld = entry(
			"too-old",
			new Date(lower.data.publishedAt.getTime() - 1),
		);
		collections.news!.push(lower, tooOld);
		expect(
			selectFreshNewsItems(collections.news!, now).map((item) => item.id),
		).toEqual(["boundary", "past", "lower"]);
		expect(
			(await getFreshNewsSitemapEntries(now)).map((item) => item.path),
		).toEqual(["/news/boundary", "/news/past", "/news/lower"]);
		const text = await (await googleNews(context())).text();
		const xml = new DOMParser().parseFromString(text, "text/xml");
		expect(
			Array.from(xml.querySelectorAll("loc"), (node) => node.textContent),
		).toEqual(
			["boundary", "past", "lower"].map(
				(id) => `https://academy.test/news/${id}`,
			),
		);
		expect(
			Array.from(
				text.matchAll(/<news:publication_date>(.*?)<\/news:publication_date>/g),
				(match) => match[1],
			),
		).toEqual(
			[boundary, past, lower].map((item) =>
				item.data.publishedAt.toISOString(),
			),
		);
	});

	it("Google News is a valid empty sitemap when nothing is currently eligible", async () => {
		collections.news = [future, invalid, entry("old", new Date("2026-01-01"))];
		expect(await getFreshNewsSitemapEntries(now)).toEqual([]);
		const text = await (await googleNews(context())).text();
		expect(text).toContain("<urlset");
		expect(text).not.toContain("<url>");
	});

	it("OPML does not advertise a contributor based only on future News", async () => {
		collections.people!.push(entry("future-reporter", now));
		collections.news = [
			past,
			entry("scheduled", future.data.publishedAt, {
				authors: ["future-reporter"],
			}),
		];
		const text = await (await opml(context())).text();
		expect(text).toContain("/api/feeds/people/reporter.xml");
		expect(text).not.toContain("/api/feeds/people/future-reporter.xml");
	});

	it("all 37 authored News URLs survive in feeds, search and the regular sitemap", async () => {
		collections.news = AUTHORED_NEWS.map(([id, publishedAt]) => ({
			id,
			data: {
				title: `Discovery ${id}`,
				description: `About ${id}`,
				publishedAt: new Date(publishedAt),
				authors: [{ collection: "people", id: "reporter" }],
				technologies: ["kubernetes"],
			},
		}));
		expect(collections.news).toHaveLength(37);
		const expected = collections.news.map((item) => `/news/${item.id}`).sort();
		for (const [, handler] of feeds.slice(0, 6))
			expect((await feedNewsPaths(handler)).sort()).toEqual(expected);
		expect(
			(await buildSearchIndex())
				.filter((item) => item.type === "news")
				.map((item) => item.href)
				.sort(),
		).toEqual(expected);
		expect((await getNewsSitemapEntries(now)).map((item) => item.path)).toEqual(
			expected,
		);
	});

	it.each([
		["News RSS", newsRss],
		["News Atom", newsAtom],
		["News JSON", newsJson],
		["Google News sitemap", googleNews],
	] as const)("%s caches on the news collection and only tags published stories", async (_name, handler) => {
		const request = context();
		await handler(request);
		expect(setContentCache).toHaveBeenCalledTimes(1);
		const [target, input] = setContentCache.mock.calls[0]!;
		expect(target).toBe(request);
		expect(input.collections).toContain("news");
		const ids = (input.entries as { id: string }[]).map((item) => item.id);
		expect(ids).toContain("boundary");
		expect(ids).not.toContain("future");
		expect(ids).not.toContain("invalid");
	});
});

// Every News story authored before the move to D1 (slug, publishedAt), from the
// former content/news tree and the platform news seed; these URLs must stay live.
const AUTHORED_NEWS: ReadonlyArray<readonly [string, string]> = [
	["2026-06-01-cloud-native-ai-infra-digest", "2026-06-01T00:00:00.000Z"],
	["2026-06-05-envoy-istio-nccl", "2026-06-05T00:00:00.000Z"],
	["2026-06-09-nccl-opentelemetry-cert-manager", "2026-06-09T00:00:00.000Z"],
	["2026-06-13-vllm-sglang-kubernetes-kueue-helm", "2026-06-13T00:00:00.000Z"],
	["2026-06-20-runc-1-5-prometheus-3-13-talos", "2026-06-20T00:00:00.000Z"],
	["2026-09-18-gloo-interrupted-validation", "2026-09-18T00:00:00.000Z"],
	[
		"2026-09-19-externaldns-023-dry-run-crd-registry",
		"2026-09-19T00:00:00.000Z",
	],
	[
		"aks-critical-privilege-escalation-cve-2026-33105",
		"2026-04-05T00:00:00.000Z",
	],
	[
		"backstage-1-51-catalog-perf-ms-graph-incremental",
		"2026-05-20T00:00:00.000Z",
	],
	["cilium-may-2026-patch-wave", "2026-05-13T00:00:00.000Z"],
	["containerd-cve-2026-46680-runasnonroot-bypass", "2026-05-20T00:00:00.000Z"],
	["crio-1-36-spdystream-cve-2026-35469", "2026-05-05T00:00:00.000Z"],
	[
		"dragonfly-native-huggingface-modelscope-protocols",
		"2026-04-08T00:00:00.000Z",
	],
	["etcd-3-7-beta-v2-api-removed", "2026-05-20T00:00:00.000Z"],
	["flux-2-8-8-go-git-cves-helm-controller-memory", "2026-05-20T00:00:00.000Z"],
	["helm-4-2-3-21-v3-eol-warning", "2026-05-14T00:00:00.000Z"],
	[
		"istio-ambient-multicluster-inference-extension",
		"2026-03-25T00:00:00.000Z",
	],
	["kubernetes-1-36-dra-drivers-features-beta", "2026-05-07T00:00:00.000Z"],
	[
		"kubernetes-1-36-pod-level-resource-managers-alpha",
		"2026-05-01T00:00:00.000Z",
	],
	["kubernetes-1-36-podgroup-workload-scheduling", "2026-05-13T00:00:00.000Z"],
	["kubernetes-1-36-psi-metrics-ga", "2026-05-12T00:00:00.000Z"],
	[
		"kubernetes-1-36-server-side-sharded-list-watch-alpha",
		"2026-05-06T00:00:00.000Z",
	],
	[
		"kubernetes-1-36-service-externalips-deprecation",
		"2026-05-14T00:00:00.000Z",
	],
	["kubernetes-1-36-sneak-peek", "2026-03-30T00:00:00.000Z"],
	["kubernetes-may-2026-patch-wave", "2026-05-12T00:00:00.000Z"],
	["kubevirt-1-8-hypervisor-abstraction", "2026-03-25T00:00:00.000Z"],
	["kyverno-graduates-cncf", "2026-03-24T00:00:00.000Z"],
	["linux-foundation-12m-ai-security", "2026-03-17T00:00:00.000Z"],
	["llm-d-accepted-cncf-sandbox", "2026-03-24T00:00:00.000Z"],
	["microcks-cncf-incubation", "2026-05-07T00:00:00.000Z"],
	["nvidia-donates-gpu-dra-driver-to-cncf", "2026-03-24T00:00:00.000Z"],
	["ofu-fleet-scale-gpu-efficiency-arxiv", "2026-05-20T00:00:00.000Z"],
	["openai-acquires-astral-ruff-uv", "2026-03-19T00:00:00.000Z"],
	["otel-collector-0-152-genai-normalizer", "2026-05-12T00:00:00.000Z"],
	[
		"prometheus-3-12-rc-promql-window-functions-stackit-fix",
		"2026-05-20T00:00:00.000Z",
	],
	["spire-1-15-sigstore-stable-vault-key-manager", "2026-05-20T00:00:00.000Z"],
	["vllm-0-21-blackwell-transformers-v5", "2026-05-15T00:00:00.000Z"],
];
