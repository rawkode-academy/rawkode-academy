import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "@astrojs/compiler";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import * as runtime from "astro/runtime/server/index.js";
import { parse as parseHtml } from "node-html-parser";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildBroadcastEventJsonLd } from "@/lib/broadcast-event-jsonld";
import { decodeImageServicePayload } from "@/lib/image-service-payload";
import type { ContentEntry } from "@/lib/live-content";
import * as openGraphLib from "@/lib/open-graph";
import {
	clampDescription,
	formatPageTitle,
	IMAGE_SERVICE_URL,
	inferImageMimeType,
	isSvgImageUrl,
	META_DESCRIPTION_MAX_LENGTH,
	normalizeTwitterHandle,
	OPEN_GRAPH_IMAGE_HEIGHT,
	OPEN_GRAPH_IMAGE_WIDTH,
	resolveCanonicalUrl,
	resolveOpenGraphImage,
	serializeJsonLd,
	TITLE_MAX_LENGTH,
	TWITTER_SITE_HANDLE,
} from "@/lib/open-graph";
import * as partnershipsLib from "@/lib/partnerships";
import { buildPersonJsonLd } from "@/lib/person-jsonld";
import { plainTextDescription } from "@/lib/plain-text-description";
import * as siteLib from "@/lib/site";
import {
	applyRobotsNoindexHeader,
	isNonProductionHost,
	robotsMiddleware,
} from "@/middleware/robots";

let upstreamWorkerHandler: (
	request: Request,
	env: unknown,
	ctx: unknown,
) => Promise<Response> = async () => new Response("ok", { status: 200 });

vi.mock("@astrojs/cloudflare/handler", () => ({
	handle: (request: Request, env: unknown, ctx: unknown) =>
		upstreamWorkerHandler(request, env, ctx),
}));

import worker from "@/worker";

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = resolve(websiteRoot, "../../..");

type AstroComponent = Parameters<
	Awaited<ReturnType<typeof AstroContainer.create>>["renderToString"]
>[0];

type StubFactory = (
	result: never,
	props: never,
	slots: Record<string, never>,
) => unknown;

const stubComponent = (factory: StubFactory) =>
	runtime.createComponent(factory as never);

const emptyComponent = stubComponent(() => runtime.render``);

async function compileAstroComponent(
	relativeSrcPath: string,
	imports: Record<string, unknown>,
): Promise<AstroComponent> {
	const source = readFileSync(
		resolve(websiteRoot, "src", relativeSrcPath),
		"utf8",
	);
	const compiled = await transform(source, { filename: relativeSrcPath });
	expect(compiled.diagnostics).toEqual([]);
	const transpiled = ts
		.transpileModule(compiled.code, {
			compilerOptions: {
				module: ts.ModuleKind.CommonJS,
				target: ts.ScriptTarget.ES2022,
			},
		})
		.outputText.replace(/\bimport\.meta\.env\b/g, "__importMetaEnv");

	const exportsObj: { default?: AstroComponent } = {};
	const moduleMap: Record<string, unknown> = {
		"astro/runtime/server/index.js": {
			...runtime,
			createMetadata: () => ({}),
		},
		...imports,
	};

	new Function(
		"require",
		"exports",
		"__importMetaEnv",
		transpiled,
	)(
		(specifier: string) => {
			if (
				specifier.includes("?astro&type=style") ||
				specifier.endsWith(".css")
			) {
				return { __esModule: true, default: "" };
			}
			if (!(specifier in moduleMap)) {
				throw new Error(
					`Unexpected import "${specifier}" while compiling ${relativeSrcPath}`,
				);
			}
			const target = moduleMap[specifier];
			return typeof target === "object" && target !== null
				? { __esModule: true, ...(target as Record<string, unknown>) }
				: target;
		},
		exportsObj,
		{ DEV: false, PROD: true, SSR: true },
	);

	if (!exportsObj.default) {
		throw new Error(`Missing default export for ${relativeSrcPath}`);
	}
	return exportsObj.default;
}

function extractJsonLdBlocks(html: string): Array<Record<string, unknown>> {
	const root = parseHtml(html);
	return root
		.querySelectorAll('script[type="application/ld+json"]')
		.map((el) => JSON.parse(el.innerHTML) as Record<string, unknown>);
}

function decodePayloadFromOgUrl(url: string): Record<string, unknown> {
	const encoded = new URL(url).searchParams.get("payload");
	if (!encoded) {
		throw new Error(`Expected payload query param in ${url}`);
	}
	return decodeImageServicePayload(encoded) as Record<string, unknown>;
}

let cachedComponents:
	| {
			Head: AstroComponent;
			Opengraph: AstroComponent;
			OrganizationJsonLd: AstroComponent;
			SearchActionJsonLd: AstroComponent;
			VideoMetadata: AstroComponent;
			CourseJsonLd: AstroComponent;
			MinimalLayout: AstroComponent;
	  }
	| undefined;

async function getCompiledComponents() {
	if (cachedComponents) return cachedComponents;

	const Opengraph = await compileAstroComponent(
		"components/html/opengraph.astro",
		{
			"@/lib/open-graph": openGraphLib,
			"@/lib/site": siteLib,
		},
	);

	const SearchActionJsonLd = await compileAstroComponent(
		"components/html/search-action-jsonld.astro",
		{},
	);

	const OrganizationJsonLd = await compileAstroComponent(
		"components/html/organization-jsonld.astro",
		{
			"@/lib/partnerships": partnershipsLib,
		},
	);

	const Head = await compileAstroComponent("components/html/head.astro", {
		"astro:assets": { Font: emptyComponent },
		"@/lib/open-graph": openGraphLib,
		"@/lib/site": siteLib,
		"../analytics/index.astro": { default: emptyComponent },
		"../posthog/index.astro": { default: emptyComponent },
		"../grafana/index.astro": { default: emptyComponent },
		"../theme/ThemeScript.astro": { default: emptyComponent },
		"./opengraph.astro": { default: Opengraph },
		"./search-action-jsonld.astro": { default: SearchActionJsonLd },
		"./organization-jsonld.astro": { default: OrganizationJsonLd },
	});

	const VideoMetadata = await compileAstroComponent(
		"components/html/video-metadata.astro",
		{
			"@/lib/broadcast-event-jsonld": { buildBroadcastEventJsonLd },
			"@/lib/plain-text-description": { plainTextDescription },
		},
	);

	const CourseJsonLd = await compileAstroComponent(
		"components/html/course-jsonld.astro",
		{
			"@/lib/person-jsonld": { buildPersonJsonLd },
		},
	);

	const MinimalLayout = await compileAstroComponent("layouts/minimal.astro", {
		"@/components/theme/ThemeScript.astro": { default: emptyComponent },
		"@/styles/global.css": { default: "" },
	});

	cachedComponents = {
		Head,
		Opengraph,
		OrganizationJsonLd,
		SearchActionJsonLd,
		VideoMetadata,
		CourseJsonLd,
		MinimalLayout,
	};
	return cachedComponents;
}

async function renderAstro(
	component: AstroComponent,
	url: string,
	props: Record<string, unknown> = {},
	options: { site?: string | undefined } = {},
) {
	const container = await AstroContainer.create(
		options.site ? { astroConfig: { site: options.site } } : undefined,
	);
	const html = await container.renderToString(component, {
		request: new Request(url),
		props,
	});
	return { html, dom: parseHtml(html), jsonLd: extractJsonLdBlocks(html) };
}

describe("M1 Suite 1 — F01 & F05: OpenGraph Image Resolution, SVG Guard & Metadata", () => {
	it("never emits raw .svg URLs even when useImageDirectly is true, routing them to image.rawkode.academy PNG share cards", () => {
		for (const svgCandidate of [
			"https://content.rawkode.academy/technologies/kubernetes/icon.svg",
			"https://content.rawkode.academy/technologies/cilium/icon.SVG?v=2",
			"https://content.rawkode.academy/technologies/flux/icon.svg#mark",
		]) {
			const resolved = resolveOpenGraphImage({
				title: "Kubernetes Guides & Videos",
				description: "Explore Kubernetes tutorials.",
				image: { image: svgCandidate },
				pageUrl: new URL("https://rawkode.academy/technology/kubernetes"),
				useImageDirectly: true,
			});

			expect(resolved.url.startsWith(`${IMAGE_SERVICE_URL}?`)).toBe(true);
			expect(resolved.url).not.toMatch(/\.svg(?:$|[?#])/i);
			expect(resolved.type).toBe("image/png");
			expect(resolved.width).toBe(OPEN_GRAPH_IMAGE_WIDTH);
			expect(resolved.height).toBe(OPEN_GRAPH_IMAGE_HEIGHT);
			expect(decodePayloadFromOgUrl(resolved.url)).toMatchObject({
				format: "png",
				title: "Kubernetes Guides & Videos",
				image: svgCandidate,
			});
		}
	});

	it("also guards explicit format='svg' or mimeType='image/svg+xml' on extensionless URLs", () => {
		const resolved = resolveOpenGraphImage({
			title: "Vector Logo",
			image: {
				image: "https://content.rawkode.academy/assets/logo-vector",
				format: "svg",
			},
			pageUrl: new URL("https://rawkode.academy/technology/vector"),
			useImageDirectly: true,
		});

		expect(resolved.url.startsWith(`${IMAGE_SERVICE_URL}?`)).toBe(true);
		expect(resolved.type).toBe("image/png");
	});

	it("infers accurate MIME types from pathname extensions even when legacy format='png' is passed", () => {
		expect(
			inferImageMimeType(
				"https://rawkode.academy/covers/architecture.jpg?w=1200#top",
				undefined,
				"png",
			),
		).toBe("image/jpeg");
		expect(
			inferImageMimeType("https://rawkode.academy/covers/card.webp"),
		).toBe("image/webp");
		expect(
			inferImageMimeType("https://rawkode.academy/covers/card.png"),
		).toBe("image/png");
		expect(
			inferImageMimeType(
				"https://rawkode.academy/covers/no-ext",
				"image/jpg",
			),
		).toBe("image/jpeg");
	});

	it("preserves explicit width, height, mimeType, and alt on non-SVG direct images and defaults R2 video thumbnails to 1280x720", () => {
		const explicit = resolveOpenGraphImage({
			title: "Editorial Title",
			ogTitle: "Social Title",
			image: {
				image: "https://content.rawkode.academy/articles/cover.webp",
				width: 1600,
				height: 900,
				alt: "Diagram of cluster networking",
			},
			pageUrl: new URL("https://rawkode.academy/read/cluster-networking"),
			useImageDirectly: true,
		});

		expect(explicit).toEqual({
			url: "https://content.rawkode.academy/articles/cover.webp",
			alt: "Diagram of cluster networking",
			type: "image/webp",
			width: 1600,
			height: 900,
		});

		const r2VideoThumb = resolveOpenGraphImage({
			title: "Deep Dive into eBPF",
			image: {
				image:
					"https://content.rawkode.academy/videos/ebpf-deep-dive/thumbnail.webp",
			},
			pageUrl: new URL("https://rawkode.academy/watch/ebpf-deep-dive"),
			useImageDirectly: true,
		});

		expect(r2VideoThumb).toEqual({
			url: "https://content.rawkode.academy/videos/ebpf-deep-dive/thumbnail.webp",
			alt: "Deep Dive into eBPF",
			type: "image/webp",
			width: 1280,
			height: 720,
		});
	});

	it("normalizes Twitter handles from raw handles, @handles, and x.com/twitter.com profile URLs", () => {
		expect(TWITTER_SITE_HANDLE).toBe("@rawkodeacademy");
		expect(normalizeTwitterHandle("rawkode")).toBe("@rawkode");
		expect(normalizeTwitterHandle("@rawkode")).toBe("@rawkode");
		expect(normalizeTwitterHandle("https://x.com/rawkode?s=20")).toBe(
			"@rawkode",
		);
		expect(
			normalizeTwitterHandle("https://twitter.com/RawkodeAcademy/status"),
		).toBe("@RawkodeAcademy");
		expect(normalizeTwitterHandle("   ")).toBeUndefined();
		expect(normalizeTwitterHandle(undefined)).toBeUndefined();
	});
});

describe("M1 Suite 2 — F02 & F03: Edge www 301, Preview noindex, Feed Unblocking & DNS CUE", () => {
	beforeEach(() => {
		upstreamWorkerHandler = async () =>
			new Response("<html><body>ok</body></html>", {
				status: 200,
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
	});

	const invokeWorkerFetch = (urlStr: string) =>
		worker.fetch(
			new Request(urlStr) as never,
			{} as never,
			{ waitUntil: () => {} } as never,
		);

	it("301-redirects www.rawkode.academy preserving path and query without X-Robots-Tag noindex", async () => {
		let handlerCalled = false;
		upstreamWorkerHandler = async () => {
			handlerCalled = true;
			return new Response("unexpected");
		};

		const response = await invokeWorkerFetch(
			"https://www.rawkode.academy/watch/klustered-1?page=2&t=45",
		);

		expect(handlerCalled).toBe(false);
		expect(response.status).toBe(301);
		expect(response.headers.get("Location")).toBe(
			"https://rawkode.academy/watch/klustered-1?page=2&t=45",
		);
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
		expect(response.headers.get("X-Robots-Tag")).toBeNull();
	});

	it("attaches X-Robots-Tag: noindex, nofollow on non-production hosts including immutable-header static responses", async () => {
		upstreamWorkerHandler = async () => {
			const base = new Response("User-agent: *\nAllow: /\n", {
				status: 200,
				headers: { "Content-Type": "text/plain; charset=utf-8" },
			});
			Object.defineProperty(base.headers, "set", {
				value: () => {
					throw new TypeError("Can't modify immutable headers");
				},
			});
			return base;
		};

		for (const previewUrl of [
			"https://pr-123-rawkode-academy-website.workers.dev/robots.txt",
			"https://branch-preview.rawkode-academy.pages.dev/read/intro",
			"https://design.rawkode.academy/about",
		]) {
			const response = await invokeWorkerFetch(previewUrl);
			expect(response.status).toBe(200);
			expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
		}
	});

	it("does not attach X-Robots-Tag on canonical rawkode.academy, local dev loopback, or klustered.live 301 redirects", async () => {
		for (const indexableUrl of [
			"https://rawkode.academy/watch",
			"http://localhost:4321/watch",
			"http://127.0.0.1:8787/api/feeds/all.xml",
		]) {
			const response = await invokeWorkerFetch(indexableUrl);
			expect(response.headers.get("X-Robots-Tag")).toBeNull();
		}

		upstreamWorkerHandler = async () =>
			new Response(null, {
				status: 301,
				headers: { Location: "https://rawkode.academy/shows/klustered" },
			});
		const legacyRedirect = await invokeWorkerFetch("https://klustered.live/");
		expect(legacyRedirect.status).toBe(301);
		expect(legacyRedirect.headers.get("X-Robots-Tag")).toBeNull();
	});

	it("exempts /api/feeds/* in robotsMiddleware on production and localhost while blocking private APIs and preview hosts", async () => {
		const invokeMiddleware = async (urlStr: string): Promise<Response> => {
			const url = new URL(urlStr);
			const result = await robotsMiddleware(
				{ url } as never,
				async () =>
					new Response("<rss/>", {
						status: 200,
						headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
					}),
			);
			if (!result) {
				throw new Error("Expected Response from robotsMiddleware");
			}
			return result;
		};

		for (const allowedFeedUrl of [
			"https://rawkode.academy/api/feeds/all.xml",
			"https://rawkode.academy/api/feeds/videos.atom",
			"https://rawkode.academy/api/feeds/shows/klustered.xml",
			"http://127.0.0.1:4321/api/feeds/shows/rawkode-live/ep-1/chapters.json",
			"http://localhost:4321/api/feeds/all.json",
		]) {
			const res = await invokeMiddleware(allowedFeedUrl);
			expect(res.headers.get("X-Robots-Tag"), allowedFeedUrl).toBeNull();
		}

		for (const blockedUrl of [
			"https://rawkode.academy/api/auth/session",
			"https://rawkode.academy/api/cache/invalidate",
			"https://rawkode.academy/_server-islands/ContinueWatchingRail",
			"https://rawkode.academy/internal/analytics",
			"https://rawkode.academy/graphql",
			"https://rawkode.academy/settings",
			"https://preview.workers.dev/api/feeds/all.xml",
			"https://www.rawkode.academy/api/feeds/all.xml",
		]) {
			const res = await invokeMiddleware(blockedUrl);
			expect(res.headers.get("X-Robots-Tag"), blockedUrl).toBe(
				"noindex, nofollow",
			);
		}

		expect(isNonProductionHost("rawkode.academy")).toBe(false);
		expect(isNonProductionHost("RAWKODE.ACADEMY.")).toBe(false);
		expect(isNonProductionHost("localhost")).toBe(false);
		expect(isNonProductionHost("127.0.0.1")).toBe(false);
		expect(isNonProductionHost("[::1]")).toBe(false);
		expect(isNonProductionHost("www.rawkode.academy")).toBe(true);
		expect(isNonProductionHost("preview.workers.dev")).toBe(true);

		const upgradeRes = applyRobotsNoindexHeader(
			new Response(null, { status: 200 }),
		);
		expect(upgradeRes.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
	});

	it("declares proxied www CNAME in rawkode.academy.cue without if comprehensions and configures /opensearch.xml in public/_headers", () => {
		const dnsCue = readFileSync(
			resolve(repoRoot, "infrastructure/dns/domains/rawkode.academy.cue"),
			"utf8",
		);
		expect(dnsCue).toMatch(
			/\bwww:\s*\{\s*target:\s*"rawkode\.academy"\s*,\s*proxied:\s*true\s*\}/,
		);
		expect(dnsCue).not.toMatch(/\bif\b/);

		const headersFile = readFileSync(
			resolve(websiteRoot, "public/_headers"),
			"utf8",
		);
		expect(headersFile).toMatch(
			/\/opensearch\.xml\s*\n\s*Content-Type:\s*application\/opensearchdescription\+xml;\s*charset=utf-8/,
		);
		expect(headersFile).not.toContain("prerender = true");
	});
});

describe("M1 Suite 3 — F04, F05, F06 & F07: Title/Description/Canonical Helpers, <Head>, <OpenGraph>, Favicons & Webmanifest", () => {
	it("normalizes page titles without duplicate brand suffixes, double pipes, or >60-char suffix overflows", () => {
		expect(formatPageTitle(undefined)).toBe("Rawkode Academy");
		expect(formatPageTitle("   ")).toBe("Rawkode Academy");
		expect(formatPageTitle("Rawkode Academy")).toBe("Rawkode Academy");
		expect(formatPageTitle("Settings - Rawkode Academy")).toBe(
			"Settings | Rawkode Academy",
		);
		expect(
			formatPageTitle("Home - Rawkode Academy | Rawkode Academy"),
		).toBe("Home | Rawkode Academy");
		expect(formatPageTitle("About Rawkode Academy")).toBe(
			"About Rawkode Academy",
		);
		expect(formatPageTitle("Kubernetes | Learning Path")).toBe(
			"Kubernetes · Learning Path | Rawkode Academy",
		);

		const multiPipeLong = formatPageTitle(
			"Enterprise Cluster Operations | Zero Trust | Rawkode Live",
		);
		expect((multiPipeLong.match(/\|/g) ?? []).length).toBeLessThanOrEqual(1);

		const nearThreshold = formatPageTitle(
			"Production Ready Kubernetes Networking Today",
		);
		expect(nearThreshold.length).toBeLessThanOrEqual(TITLE_MAX_LENGTH);
	});

	it("clamps >160-char descriptions at word boundaries without mutating compliant descriptions", () => {
		const exact160 = "a".repeat(160);
		expect(clampDescription(exact160)).toBe(exact160);

		const shortCopy =
			"Hands-on cloud native education for Kubernetes and platform engineers.";
		expect(clampDescription(shortCopy)).toBe(shortCopy);

		const longProse =
			"Learn how Cilium replaces kube-proxy with eBPF data paths, enforces L7 network policies, provides Hubble observability, and scales multi-cluster service mesh routing in production.";
		const clamped = clampDescription(longProse);
		expect(clamped.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX_LENGTH);
		expect(clamped.endsWith("…")).toBe(true);
		expect(clamped).not.toMatch(/[,.;:\-–—\s]…$/);
		expect(clamped).toContain("Hubble observability");

		const unbrokenToken = `https://rawkode.academy/${"x".repeat(200)}`;
		const hardClamped = clampDescription(unbrokenToken);
		expect(hardClamped.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX_LENGTH);
		expect(hardClamped.endsWith("…")).toBe(true);
	});

	it("resolves canonical URLs with optional self-referencing pagination override while stripping hashes and trailing slashes", () => {
		expect(
			resolveCanonicalUrl(
				undefined,
				"/watch/",
				new URL("https://rawkode.academy"),
			).href,
		).toBe("https://rawkode.academy/watch");

		expect(
			resolveCanonicalUrl(
				"https://rawkode.academy/watch/?page=2#results",
				"/watch",
				new URL("https://rawkode.academy"),
			).href,
		).toBe("https://rawkode.academy/watch?page=2");

		expect(
			resolveCanonicalUrl(
				"/read?page=3",
				"/read",
				new URL("https://rawkode.academy"),
			).href,
		).toBe("https://rawkode.academy/read?page=3");
	});

	it("renders decoupled <title> vs ogTitle, clamped description, canonical override, favicons, OpenSearch, and Twitter overrides in <Head>", async () => {
		const { Head } = await getCompiledComponents();
		const longDescription =
			"Deep dive into Kubernetes 1.35 scheduling improvements, in-place pod vertical scaling, structured authentication configurations, and production rollout strategies for platform teams.";

		const { dom, jsonLd } = await renderAstro(
			Head,
			"https://rawkode.academy/read?page=2",
			{
				title: "Articles — Page 2 - Rawkode Academy",
				ogTitle: "Punchy Social Headline",
				description: longDescription,
				canonicalUrl: "https://rawkode.academy/read?page=2",
				twitterCard: "summary",
				twitterCreator: "https://x.com/rawkode",
				pageType: "CollectionPage",
			},
		);

		expect(dom.querySelector("title")?.text).toBe(
			"Articles — Page 2 | Rawkode Academy",
		);
		expect(
			dom.querySelector('meta[property="og:title"]')?.getAttribute("content"),
		).toBe("Punchy Social Headline");
		expect(
			dom.querySelector('meta[name="twitter:title"]')?.getAttribute("content"),
		).toBe("Punchy Social Headline");

		const metaDesc =
			dom.querySelector('meta[name="description"]')?.getAttribute("content") ??
			"";
		expect(metaDesc.length).toBeLessThanOrEqual(160);
		expect(
			dom
				.querySelector('meta[property="og:description"]')
				?.getAttribute("content"),
		).toBe(metaDesc);
		expect(
			dom
				.querySelector('meta[name="twitter:description"]')
				?.getAttribute("content"),
		).toBe(metaDesc);

		expect(
			dom.querySelector('link[rel="canonical"]')?.getAttribute("href"),
		).toBe("https://rawkode.academy/read?page=2");
		expect(
			dom.querySelector('meta[property="og:url"]')?.getAttribute("content"),
		).toBe("https://rawkode.academy/read?page=2");
		expect(
			dom.querySelector('meta[property="og:locale"]')?.getAttribute("content"),
		).toBe("en_US");

		const ogImageUrl =
			dom.querySelector('meta[property="og:image"]')?.getAttribute("content") ??
			"";
		expect(decodePayloadFromOgUrl(ogImageUrl).title).toBe(
			"Punchy Social Headline",
		);

		expect(
			dom.querySelector('meta[name="twitter:card"]')?.getAttribute("content"),
		).toBe("summary");
		expect(
			dom.querySelector('meta[name="twitter:site"]')?.getAttribute("content"),
		).toBe("@rawkodeacademy");
		expect(
			dom
				.querySelector('meta[name="twitter:creator"]')
				?.getAttribute("content"),
		).toBe("@rawkode");
		expect(
			dom
				.querySelector('meta[name="twitter:image:alt"]')
				?.getAttribute("content"),
		).toBe("Punchy Social Headline");

		expect(
			dom
				.querySelector('link[rel="icon"][href="/favicon.ico"]')
				?.getAttribute("sizes"),
		).toBe("48x48");
		expect(
			dom.querySelector('link[rel="mask-icon"]')?.getAttribute("href"),
		).toBe("/safari-pinned-tab.svg");
		expect(
			dom
				.querySelector(
					'link[rel="search"][type="application/opensearchdescription+xml"]',
				)
				?.getAttribute("href"),
		).toBe("/opensearch.xml");

		const webPage = jsonLd.find((item) => item["@type"] === "CollectionPage");
		expect(webPage).toMatchObject({
			"@id": "https://rawkode.academy/read?page=2#webpage",
			url: "https://rawkode.academy/read?page=2",
			inLanguage: "en",
			isPartOf: { "@id": "https://rawkode.academy/#website" },
			publisher: { "@id": "https://rawkode.academy/#organization" },
		});
	});

	it("guards og:image:width and og:image:height independently so inferred MIME without dimensions never emits 'undefined'", async () => {
		const { Opengraph } = await getCompiledComponents();
		const { dom, html } = await renderAstro(
			Opengraph,
			"https://rawkode.academy/read/sample",
			{
				title: "Sample Direct JPG",
				image: {
					image: new URL("https://rawkode.academy/images/direct-cover.jpg"),
				},
				useImageDirectly: true,
			},
		);

		expect(
			dom
				.querySelector('meta[property="og:image:type"]')
				?.getAttribute("content"),
		).toBe("image/jpeg");
		expect(dom.querySelector('meta[property="og:image:width"]')).toBeNull();
		expect(dom.querySelector('meta[property="og:image:height"]')).toBeNull();
		expect(html).not.toContain('content="undefined"');
	});

	it("removes broken /favicon.svg from minimal.astro and aligns public/site.webmanifest icons and colors", async () => {
		const { MinimalLayout } = await getCompiledComponents();
		const { html, dom } = await renderAstro(
			MinimalLayout,
			"https://rawkode.academy/embed/webcontainer",
			{ title: "Playground", noindex: true },
		);

		expect(html).not.toContain("/favicon.svg");
		expect(
			dom
				.querySelector('link[rel="icon"][href="/favicon.ico"]')
				?.getAttribute("sizes"),
		).toBe("48x48");
		expect(
			dom.querySelector('link[rel="icon"][href="/icon-dark.svg"]'),
		).not.toBeNull();
		expect(
			dom.querySelector('link[rel="icon"][href="/icon-light.svg"]'),
		).not.toBeNull();

		const manifest = JSON.parse(
			readFileSync(resolve(websiteRoot, "public/site.webmanifest"), "utf8"),
		) as {
			lang: string;
			theme_color: string;
			background_color: string;
			icons: Array<{ src: string; sizes: string; purpose: string }>;
		};

		expect(manifest.lang).toBe("en");
		expect(manifest.theme_color).toBe("#f4f7fb");
		expect(manifest.background_color).toBe("#0a1220");
		expect(manifest.icons).toEqual([
			{
				src: "/android-chrome-192x192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/android-chrome-512x512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/android-chrome-512x512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		]);

		for (const publicAsset of [
			"favicon.ico",
			"safari-pinned-tab.svg",
			"icon-dark.svg",
			"icon-light.svg",
			"android-chrome-192x192.png",
			"android-chrome-512x512.png",
		]) {
			expect(
				existsSync(resolve(websiteRoot, "public", publicAsset)),
				publicAsset,
			).toBe(true);
		}
	});
});

describe("M1 Suite 4 — F08: Schema.org Knowledge Graph, noindex Suppression, VideoMetadata & CourseJsonLd", () => {
	it("emits rich EducationalOrganization + Organization schema on / and /about with verified sameAs, founder, logo, and offers", async () => {
		const { OrganizationJsonLd } = await getCompiledComponents();

		for (const route of [
			"https://rawkode.academy/",
			"https://rawkode.academy/about",
		]) {
			const { jsonLd } = await renderAstro(OrganizationJsonLd, route);
			expect(jsonLd).toHaveLength(1);
			const org = jsonLd[0]!;
			expect(org["@type"]).toEqual(["EducationalOrganization", "Organization"]);
			expect(org["@id"]).toBe("https://rawkode.academy/#organization");
			expect(org.sameAs).toEqual([
				"https://github.com/rawkode-academy",
				"https://www.youtube.com/@RawkodeAcademy",
				"https://bsky.app/profile/rawkode.academy",
				"https://www.linkedin.com/company/rawkode-academy",
				"https://x.com/RawkodeAcademy",
			]);
			expect(org.founder).toMatchObject({
				"@type": "Person",
				name: "David Flanagan",
				url: "https://rawkode.academy/people/rawkode",
			});
			expect(org.logo).toMatchObject({
				"@type": "ImageObject",
				url: "https://rawkode.academy/android-chrome-512x512.png",
				width: 512,
				height: 512,
			});
			expect(Array.isArray(org.offers)).toBe(true);
		}

		const nonHome = await renderAstro(
			OrganizationJsonLd,
			"https://rawkode.academy/watch",
		);
		expect(nonHome.jsonLd).toHaveLength(0);
	});

	it("connects WebSite and WebPage via @id and suppresses JSON-LD when noindex is true", async () => {
		const { Head } = await getCompiledComponents();

		const home = await renderAstro(Head, "https://rawkode.academy/", {
			title: "Rawkode Academy",
		});
		const website = home.jsonLd.find((item) => item["@type"] === "WebSite");
		const webpage = home.jsonLd.find((item) => item["@type"] === "WebPage");
		const org = home.jsonLd.find((item) =>
			Array.isArray(item["@type"])
				? (item["@type"] as string[]).includes("EducationalOrganization")
				: false,
		);

		expect(website).toMatchObject({
			"@id": "https://rawkode.academy/#website",
			inLanguage: "en",
			publisher: { "@id": "https://rawkode.academy/#organization" },
		});
		expect(webpage).toMatchObject({
			"@id": "https://rawkode.academy/#webpage",
			inLanguage: "en",
			isPartOf: { "@id": "https://rawkode.academy/#website" },
			publisher: { "@id": "https://rawkode.academy/#organization" },
		});
		expect(org).toBeDefined();

		const noindexRender = await renderAstro(
			Head,
			"https://rawkode.academy/search?q=cilium",
			{
				title: "Search",
				noindex: true,
				pageType: "SearchResultsPage",
			},
		);
		expect(
			noindexRender.dom
				.querySelector('meta[name="robots"]')
				?.getAttribute("content"),
		).toBe("noindex,follow");
		expect(noindexRender.jsonLd).toHaveLength(0);
	});

	it("cleans VideoMetadata: removes og:video:thumbnail and empty isVideoList ItemList, guards stream/caption URLs, and populates BroadcastEvent.endDate on past broadcasts", async () => {
		const { VideoMetadata } = await getCompiledComponents();

		const listRender = await renderAstro(
			VideoMetadata,
			"https://rawkode.academy/shows/klustered",
			{
				title: "Klustered",
				description: "Live Kubernetes debugging.",
				isVideoList: true,
			},
		);
		expect(listRender.jsonLd).toHaveLength(0);
		expect(listRender.html.trim()).toBe("");

		const pastStart = "2025-05-10T16:00:00.000Z";
		const completedLive = await renderAstro(
			VideoMetadata,
			"https://rawkode.academy/watch/klustered-ep1",
			{
				title: "Klustered Episode 1",
				description: "Debugging broken clusters live.",
				thumbnailUrl:
					"https://content.rawkode.academy/videos/klustered-ep1/thumbnail.webp",
				publishedAt: pastStart,
				duration: 3600,
				streamUrl:
					"https://content.rawkode.academy/videos/klustered-ep1/stream.m3u8",
				captionUrl:
					"https://content.rawkode.academy/videos/klustered-ep1/captions/en.vtt",
				isLiveBroadcast: true,
			},
		);

		expect(completedLive.html).not.toContain("og:video:thumbnail");
		expect(
			completedLive.dom
				.querySelector('meta[property="og:video"]')
				?.getAttribute("content"),
		).toBe("https://content.rawkode.academy/videos/klustered-ep1/stream.m3u8");
		expect(
			completedLive.dom
				.querySelector('meta[property="og:video:type"]')
				?.getAttribute("content"),
		).toBe("application/x-mpegURL");

		expect(completedLive.jsonLd).toHaveLength(1);
		expect(completedLive.jsonLd[0]).toMatchObject({
			"@type": "VideoObject",
			inLanguage: "en",
			contentUrl:
				"https://content.rawkode.academy/videos/klustered-ep1/stream.m3u8",
			duration: "PT1H",
			publication: {
				"@type": "BroadcastEvent",
				isLiveBroadcast: true,
				startDate: pastStart,
				endDate: "2025-05-10T17:00:00.000Z",
			},
			caption: {
				"@type": "MediaObject",
				contentUrl:
					"https://content.rawkode.academy/videos/klustered-ep1/captions/en.vtt",
				inLanguage: "en",
			},
		});

		const futureStart = new Date(Date.now() + 86_400_000).toISOString();
		const upcomingUntranscoded = await renderAstro(
			VideoMetadata,
			"https://rawkode.academy/watch/upcoming-live",
			{
				title: "Upcoming Live Build",
				description: "Joining soon.",
				thumbnailUrl: "https://i.ytimg.com/vi/abc123/maxresdefault.jpg",
				publishedAt: futureStart,
				duration: 0,
				streamUrl: "   ",
				captionUrl: "",
				embedUrl: "https://www.youtube.com/embed/abc123",
				isLiveBroadcast: true,
			},
		);

		expect(
			upcomingUntranscoded.dom.querySelector('meta[property="og:video"]'),
		).toBeNull();
		expect(
			upcomingUntranscoded.dom.querySelector(
				'meta[property="og:video:duration"]',
			),
		).toBeNull();
		const upcomingObj = upcomingUntranscoded.jsonLd[0]!;
		expect(upcomingObj).not.toHaveProperty("contentUrl");
		expect(upcomingObj).not.toHaveProperty("caption");
		expect(upcomingObj).not.toHaveProperty("duration");
		expect(upcomingObj.embedUrl).toBe("https://www.youtube.com/embed/abc123");
		expect(upcomingObj.publication).toEqual({
			"@type": "BroadcastEvent",
			isLiveBroadcast: true,
			startDate: futureStart,
		});
	});

	it("renders CourseJsonLd with optional imageUrl, omitted empty teaches, and isModule LearningResource schema", async () => {
		const { CourseJsonLd } = await getCompiledComponents();

		const baseCourse = {
			id: "kubernetes-101",
			collection: "courses",
			data: {
				title: "Kubernetes 101",
				description: "From zero to production Kubernetes.",
				publishedAt: new Date("2026-01-15T00:00:00.000Z"),
				authors: [],
				difficulty: "beginner",
				learningPath: [],
				technologies: [],
			},
		} as unknown as ContentEntry<"courses">;

		const announcedRender = await renderAstro(
			CourseJsonLd,
			"https://rawkode.academy/courses/kubernetes-101",
			{
				course: baseCourse,
				modules: [],
				authors: [],
			},
		);
		const announcedCourse = announcedRender.jsonLd[0]!;
		expect(announcedCourse["@type"]).toBe("Course");
		expect(announcedCourse.image).toBe(
			"https://rawkode.academy/android-chrome-512x512.png",
		);
		expect(announcedCourse.inLanguage).toBe("en");
		expect(announcedCourse.availableLanguage).toEqual(["en"]);
		expect(announcedCourse).not.toHaveProperty("teaches");
		expect(announcedCourse.provider).toMatchObject({
			"@id": "https://rawkode.academy/#organization",
		});

		const courseWithLearningPath = {
			...baseCourse,
			data: {
				...baseCourse.data,
				learningPath: ["Pods and Deployments", "Services and Ingress"],
			},
		} as unknown as ContentEntry<"courses">;

		const populatedCourseRender = await renderAstro(
			CourseJsonLd,
			"https://rawkode.academy/courses/kubernetes-101",
			{
				course: courseWithLearningPath,
				modules: [],
				authors: [],
			},
		);
		expect(populatedCourseRender.jsonLd[0]?.teaches).toEqual([
			"Pods and Deployments",
			"Services and Ingress",
		]);

		const lessonModule = {
			id: "kubernetes-101/pods-deep-dive",
			collection: "courseModules",
			data: {
				title: "Pods Deep Dive",
				description: "Understanding pod lifecycle and probes.",
				course: { collection: "courses", id: "kubernetes-101" },
				slug: "pods-deep-dive",
				order: 2,
				duration: 18,
				video: { id: "vid-pods" },
				publishedAt: new Date("2026-01-20T00:00:00.000Z"),
				draft: false,
				authors: [],
			},
		} as unknown as ContentEntry<"courseModules">;

		const moduleRender = await renderAstro(
			CourseJsonLd,
			"https://rawkode.academy/courses/kubernetes-101/pods-deep-dive",
			{
				course: courseWithLearningPath,
				module: lessonModule,
				isModule: true,
			},
		);
		expect(moduleRender.jsonLd[0]).toMatchObject({
			"@type": "LearningResource",
			"@id":
				"https://rawkode.academy/courses/kubernetes-101/pods-deep-dive#learningresource",
			name: "Pods Deep Dive",
			url: "https://rawkode.academy/courses/kubernetes-101/pods-deep-dive",
			inLanguage: "en",
			learningResourceType: "Video Lesson",
			educationalLevel: "Beginner",
			timeRequired: "PT18M",
			position: 2,
			image: "https://rawkode.academy/android-chrome-512x512.png",
			isPartOf: {
				"@type": "Course",
				"@id": "https://rawkode.academy/courses/kubernetes-101#course",
				name: "Kubernetes 101",
				url: "https://rawkode.academy/courses/kubernetes-101",
				provider: { "@id": "https://rawkode.academy/#organization" },
			},
		});
	});
});

describe("M1 Suite 5 — Iteration 2 Adversarial Regressions (Challengers 1 & 2)", () => {
	it("Defect #1: resolveCanonicalUrl never crashes on '//', blocks scheme-relative origin hijacking, and preserves pathname on query-only '?page=2'", () => {
		expect(
			resolveCanonicalUrl(undefined, "//", "https://rawkode.academy").href,
		).toBe("https://rawkode.academy/");
		expect(
			resolveCanonicalUrl(
				undefined,
				"//evil.com/phishing",
				"https://rawkode.academy",
			).href,
		).toBe("https://rawkode.academy/evil.com/phishing");
		expect(
			resolveCanonicalUrl("//", "/watch", "https://rawkode.academy").href,
		).toBe("https://rawkode.academy/");
		expect(
			resolveCanonicalUrl(
				"//evil.com/phishing",
				"/watch",
				"https://rawkode.academy",
			).href,
		).toBe("https://rawkode.academy/evil.com/phishing");
		expect(
			resolveCanonicalUrl("?page=2", "/watch", "https://rawkode.academy").href,
		).toBe("https://rawkode.academy/watch?page=2");
		expect(
			resolveCanonicalUrl("?page=2", "/watch/", "https://rawkode.academy").href,
		).toBe("https://rawkode.academy/watch?page=2");
		expect(
			resolveCanonicalUrl(
				new URL("https://rawkode.academy//"),
				"/watch",
				"https://rawkode.academy",
			).href,
		).toBe("https://rawkode.academy/");
	});

	it("Defect #2: inferImageMimeType & isSvgImageUrl catch parameterized SVG MIME and data:image/svg+xml while keeping .png?source=logo.svg direct", () => {
		expect(
			inferImageMimeType(
				"https://content.rawkode.academy/tech/k8s",
				"image/svg+xml; charset=utf-8",
			),
		).toBe("image/svg+xml");
		expect(
			inferImageMimeType(
				"https://content.rawkode.academy/covers/photo",
				"IMAGE/JPG; quality=85",
			),
		).toBe("image/jpeg");
		expect(
			inferImageMimeType(
				"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>",
			),
		).toBe("image/svg+xml");
		expect(
			isSvgImageUrl(
				"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>",
			),
		).toBe(true);
		expect(
			isSvgImageUrl(
				"https://content.rawkode.academy/covers/hero.png?source=logo.svg",
			),
		).toBe(false);

		const parameterizedSvg = resolveOpenGraphImage({
			title: "Kubernetes",
			image: {
				image: "https://content.rawkode.academy/tech/k8s",
				mimeType: "image/svg+xml; charset=utf-8",
			},
			pageUrl: new URL("https://rawkode.academy/technology/kubernetes"),
			useImageDirectly: true,
		});
		expect(parameterizedSvg.url.startsWith(`${IMAGE_SERVICE_URL}?`)).toBe(true);
		expect(parameterizedSvg.type).toBe("image/png");
		expect(parameterizedSvg.width).toBe(OPEN_GRAPH_IMAGE_WIDTH);
		expect(parameterizedSvg.height).toBe(OPEN_GRAPH_IMAGE_HEIGHT);

		const dataUriSvg = resolveOpenGraphImage({
			title: "Inline Vector",
			image: {
				image:
					"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>",
			},
			pageUrl: new URL("https://rawkode.academy/technology/inline"),
			useImageDirectly: true,
		});
		expect(dataUriSvg.url.startsWith(`${IMAGE_SERVICE_URL}?`)).toBe(true);
		expect(dataUriSvg.type).toBe("image/png");
		expect(decodePayloadFromOgUrl(dataUriSvg.url)).not.toHaveProperty("image");

		const rasterWithSvgQuery = resolveOpenGraphImage({
			title: "Raster Cover",
			image: {
				image:
					"https://content.rawkode.academy/covers/hero.png?source=logo.svg",
			},
			pageUrl: new URL("https://rawkode.academy/read/test"),
			useImageDirectly: true,
		});
		expect(rasterWithSvgQuery).toEqual({
			url: "https://content.rawkode.academy/covers/hero.png?source=logo.svg",
			alt: "Raster Cover",
			type: "image/png",
		});
	});

	it("Defect #3: clampDescription never splits UTF-16 surrogate pairs into lone surrogates", () => {
		const loneSurrogatePattern =
			/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

		for (const candidate of [
			"🚀".repeat(83),
			`${"a".repeat(158)}${"🚀".repeat(5)}`,
			`${"x".repeat(40)} ${"🧪".repeat(70)}`,
			"🔥".repeat(10),
		]) {
			const clamped = clampDescription(candidate);
			expect(clamped.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX_LENGTH);
			expect(clamped).not.toMatch(loneSurrogatePattern);
			expect(
				(
					clamped as string & { isWellFormed?: () => boolean }
				).isWellFormed?.() ?? true,
			).toBe(true);
		}
	});

	it("Defect #4: trims/collapses whitespace titles & alt strings (falling back to Rawkode Academy) and enforces trailing-slash NOINDEX_EXACT_PATHS", async () => {
		const { Head } = await getCompiledComponents();

		const blankTitleRender = await renderAstro(
			Head,
			"https://rawkode.academy/watch",
			{
				title: "   ",
				ogTitle: "   ",
			},
		);
		expect(blankTitleRender.dom.querySelector("title")?.text).toBe(
			"Rawkode Academy",
		);
		expect(
			blankTitleRender.dom
				.querySelector('meta[property="og:title"]')
				?.getAttribute("content"),
		).toBe("Rawkode Academy");
		expect(
			blankTitleRender.dom
				.querySelector('meta[name="twitter:title"]')
				?.getAttribute("content"),
		).toBe("Rawkode Academy");
		expect(
			blankTitleRender.dom
				.querySelector('meta[property="og:image:alt"]')
				?.getAttribute("content"),
		).toBe("Rawkode Academy");
		expect(
			blankTitleRender.dom
				.querySelector('meta[name="twitter:image:alt"]')
				?.getAttribute("content"),
		).toBe("Rawkode Academy");
		const blankWebPage = blankTitleRender.jsonLd.find(
			(item) => item["@type"] === "WebPage",
		);
		expect(blankWebPage?.name).toBe("Rawkode Academy");

		const paddedTitleRender = await renderAstro(
			Head,
			"https://rawkode.academy/watch",
			{
				title: "   Editorial   Title   ",
			},
		);
		expect(
			paddedTitleRender.dom
				.querySelector('meta[property="og:title"]')
				?.getAttribute("content"),
		).toBe("Editorial Title");
		expect(
			paddedTitleRender.dom
				.querySelector('meta[property="og:image:alt"]')
				?.getAttribute("content"),
		).toBe("Editorial Title");

		const invokeMiddleware = async (urlStr: string): Promise<Response> => {
			const result = await robotsMiddleware(
				{ url: new URL(urlStr) } as never,
				async () => new Response("ok", { status: 200 }),
			);
			if (!result) {
				throw new Error("Expected Response from robotsMiddleware");
			}
			return result;
		};

		for (const blockedSlashUrl of [
			"https://rawkode.academy/settings/",
			"https://rawkode.academy/graphql/",
			"https://rawkode.academy//settings/",
			"https://rawkode.academy/api/feeds-secret",
		]) {
			const res = await invokeMiddleware(blockedSlashUrl);
			expect(res.headers.get("X-Robots-Tag"), blockedSlashUrl).toBe(
				"noindex, nofollow",
			);
		}
	});

	it("Defect #5: escapes '</script>', '<!--', U+2028, and U+2029 across all 6 JSON-LD emitters without breaking JSON.parse", async () => {
		const { Head, VideoMetadata, CourseJsonLd } = await getCompiledComponents();
		const breakoutPayload =
			"Why </script><script>window.__pwn=1</script> <!-- comment --> \u2028\u2029 breaks HTML parsers";

		const serialized = serializeJsonLd({ text: breakoutPayload });
		expect(serialized).not.toContain("</script>");
		expect(serialized).not.toContain("<!--");
		expect(serialized).toContain("\\u003c/script>");
		expect(JSON.parse(serialized)).toEqual({ text: breakoutPayload });

		const headRender = await renderAstro(Head, "https://rawkode.academy/", {
			title: breakoutPayload,
			description: breakoutPayload,
			jsonLd: {
				"@context": "https://schema.org",
				"@type": "TechArticle",
				headline: breakoutPayload,
			},
		});
		expect(
			headRender.dom.querySelectorAll(
				'script:not([type="application/ld+json"])',
			),
		).toHaveLength(0);
		for (const scriptEl of headRender.dom.querySelectorAll(
			'script[type="application/ld+json"]',
		)) {
			expect(scriptEl.innerHTML).not.toContain("<");
		}
		expect(headRender.jsonLd).toHaveLength(4);
		expect(
			headRender.jsonLd.find((item) => item["@type"] === "TechArticle")
				?.headline,
		).toBe(breakoutPayload);
		expect(
			headRender.jsonLd.find((item) => item["@type"] === "WebPage")?.name,
		).toContain("</script><script>window.__pwn=1</script>");

		const videoRender = await renderAstro(
			VideoMetadata,
			"https://rawkode.academy/watch/xss-test",
			{
				title: breakoutPayload,
				description: breakoutPayload,
				transcript: breakoutPayload,
				publishedAt: "2026-01-10T12:00:00.000Z",
				duration: 120,
			},
		);
		expect(
			videoRender.dom.querySelectorAll(
				'script:not([type="application/ld+json"])',
			),
		).toHaveLength(0);
		for (const scriptEl of videoRender.dom.querySelectorAll(
			'script[type="application/ld+json"]',
		)) {
			expect(scriptEl.innerHTML).not.toContain("<");
		}
		expect(videoRender.jsonLd).toHaveLength(1);
		expect(videoRender.jsonLd[0]?.name).toBe(breakoutPayload);
		expect(videoRender.jsonLd[0]?.transcript).toBe(breakoutPayload);

		const courseFixture = {
			id: "xss-course",
			collection: "courses",
			data: {
				title: breakoutPayload,
				description: breakoutPayload,
				publishedAt: new Date("2026-01-15T00:00:00.000Z"),
				authors: [],
				difficulty: "beginner",
				learningPath: [breakoutPayload],
				technologies: [],
			},
		} as unknown as ContentEntry<"courses">;

		const courseRender = await renderAstro(
			CourseJsonLd,
			"https://rawkode.academy/courses/xss-course",
			{
				course: courseFixture,
				modules: [],
				authors: [],
			},
		);
		expect(
			courseRender.dom.querySelectorAll(
				'script:not([type="application/ld+json"])',
			),
		).toHaveLength(0);
		for (const scriptEl of courseRender.dom.querySelectorAll(
			'script[type="application/ld+json"]',
		)) {
			expect(scriptEl.innerHTML).not.toContain("<");
		}
		expect(courseRender.jsonLd).toHaveLength(1);
		expect(courseRender.jsonLd[0]?.name).toBe(breakoutPayload);
	});

	it("Defect #6: omits duration & og:video:duration on upcoming live broadcasts and rejects sub-second 0.4s PT0S durations", async () => {
		const { VideoMetadata } = await getCompiledComponents();

		const upcomingWithSlotDuration = await renderAstro(
			VideoMetadata,
			"https://rawkode.academy/watch/upcoming-2030",
			{
				title: "Scheduled 2030 Live Stream",
				description: "Future broadcast slot.",
				publishedAt: "2030-06-01T18:00:00.000Z",
				duration: 3600,
				streamUrl: "",
				captionUrl: "  ",
				isLiveBroadcast: true,
			},
		);

		expect(
			upcomingWithSlotDuration.dom.querySelector('meta[property="og:video"]'),
		).toBeNull();
		expect(
			upcomingWithSlotDuration.dom.querySelector(
				'meta[property="og:video:duration"]',
			),
		).toBeNull();
		expect(
			upcomingWithSlotDuration.dom.querySelector(
				'meta[property="og:video:release_date"]',
			),
		).toBeNull();
		const upcomingVo = upcomingWithSlotDuration.jsonLd[0]!;
		expect(upcomingVo).not.toHaveProperty("duration");
		expect(upcomingVo.publication).toEqual({
			"@type": "BroadcastEvent",
			isLiveBroadcast: true,
			startDate: "2030-06-01T18:00:00.000Z",
		});

		const subSecondVod = await renderAstro(
			VideoMetadata,
			"https://rawkode.academy/watch/sub-second",
			{
				title: "Sub-second Clip",
				description: "Fractional duration metadata.",
				publishedAt: "2025-05-10T16:00:00.000Z",
				duration: 0.4,
				streamUrl:
					"https://content.rawkode.academy/videos/sub-second/stream.m3u8",
			},
		);

		expect(
			subSecondVod.dom.querySelector('meta[property="og:video:duration"]'),
		).toBeNull();
		expect(subSecondVod.jsonLd[0]).not.toHaveProperty("duration");
	});

	it("Defects #7 & #8: keeps Organization/WebSite/WebPage @id graph joined under localhost Astro.site and suppresses jsonLd prop when noindex is true", async () => {
		const { Head } = await getCompiledComponents();

		const localDevHome = await renderAstro(
			Head,
			"http://localhost:4321/",
			{ title: "Rawkode Academy" },
			{ site: "http://localhost:4321" },
		);
		const website = localDevHome.jsonLd.find(
			(item) => item["@type"] === "WebSite",
		);
		const webpage = localDevHome.jsonLd.find(
			(item) => item["@type"] === "WebPage",
		);
		const org = localDevHome.jsonLd.find((item) =>
			Array.isArray(item["@type"])
				? (item["@type"] as string[]).includes("EducationalOrganization")
				: false,
		);

		expect(org?.["@id"]).toBe("https://rawkode.academy/#organization");
		expect(website?.["@id"]).toBe("https://rawkode.academy/#website");
		expect(website?.publisher).toEqual({
			"@id": "https://rawkode.academy/#organization",
		});
		expect(webpage?.isPartOf).toEqual({
			"@id": "https://rawkode.academy/#website",
		});
		expect(webpage?.publisher).toEqual({
			"@id": "https://rawkode.academy/#organization",
		});

		const noindexWithPropJsonLd = await renderAstro(
			Head,
			"https://rawkode.academy/",
			{
				title: "Draft Article",
				noindex: true,
				jsonLd: {
					"@context": "https://schema.org",
					"@type": "HowTo",
					name: "Draft",
				},
			},
		);
		expect(
			noindexWithPropJsonLd.dom
				.querySelector('meta[name="robots"]')
				?.getAttribute("content"),
		).toBe("noindex,follow");
		expect(noindexWithPropJsonLd.jsonLd).toHaveLength(0);
	});

	it("Defect #9: CourseJsonLd falls back to publishedModules when course.data.learningPath contains only whitespace", async () => {
		const { CourseJsonLd } = await getCompiledComponents();

		const whitespaceLearningPathCourse = {
			id: "cilium-101",
			collection: "courses",
			data: {
				title: "Cilium 101",
				description: "Networking with eBPF.",
				publishedAt: new Date("2026-02-01T00:00:00.000Z"),
				authors: [],
				difficulty: "intermediate",
				learningPath: ["   ", ""],
				technologies: [],
			},
		} as unknown as ContentEntry<"courses">;

		const publishedMod = {
			id: "cilium-101/ebpf-datapath",
			collection: "courseModules",
			data: {
				title: "eBPF Datapath Fundamentals",
				description: "Packet flow in Cilium.",
				course: { collection: "courses", id: "cilium-101" },
				slug: "ebpf-datapath",
				order: 1,
				duration: 15,
				publishedAt: new Date("2026-02-02T00:00:00.000Z"),
				draft: false,
				authors: [],
			},
		} as unknown as ContentEntry<"courseModules">;

		const draftMod = {
			...publishedMod,
			id: "cilium-101/draft-mod",
			data: {
				...publishedMod.data,
				title: "Unpublished Draft Module",
				draft: true,
			},
		} as unknown as ContentEntry<"courseModules">;

		const withPublishedModules = await renderAstro(
			CourseJsonLd,
			"https://rawkode.academy/courses/cilium-101",
			{
				course: whitespaceLearningPathCourse,
				modules: [publishedMod, draftMod],
				authors: [],
			},
		);
		expect(withPublishedModules.jsonLd[0]?.teaches).toEqual([
			"eBPF Datapath Fundamentals",
		]);

		const withoutPublishedModules = await renderAstro(
			CourseJsonLd,
			"https://rawkode.academy/courses/cilium-101",
			{
				course: whitespaceLearningPathCourse,
				modules: [draftMod],
				authors: [],
			},
		);
		expect(withoutPublishedModules.jsonLd[0]).not.toHaveProperty("teaches");
	});
});

describe("M1 Suite 6 — Iteration 3 Adversarial Regressions (Challenger 1)", () => {
	it("Defect #1 (Unit): resolveCanonicalUrl handles backslashes without crashing, blocks external/non-HTTP(S)/userinfo canonical poisoning, prevents trailing-slash relative doubling, and preserves localhost/production first-party origins", () => {
		expect(
			resolveCanonicalUrl(undefined, "/\\", "https://rawkode.academy").href,
		).toBe("https://rawkode.academy/");
		expect(
			resolveCanonicalUrl(undefined, "\\\\", "https://rawkode.academy").href,
		).toBe("https://rawkode.academy/");
		expect(
			resolveCanonicalUrl(
				undefined,
				"/\\evil.com/phishing",
				"https://rawkode.academy",
			).href,
		).toBe("https://rawkode.academy/evil.com/phishing");
		expect(
			resolveCanonicalUrl(
				undefined,
				"\\\\evil.com/phishing",
				"https://rawkode.academy",
			).href,
		).toBe("https://rawkode.academy/evil.com/phishing");

		expect(
			resolveCanonicalUrl("/\\", "/watch", "https://rawkode.academy").href,
		).toBe("https://rawkode.academy/");
		expect(
			resolveCanonicalUrl("\\\\", "/watch", "https://rawkode.academy").href,
		).toBe("https://rawkode.academy/");
		expect(
			resolveCanonicalUrl(
				"/\\evil.com/phishing",
				"/watch",
				"https://rawkode.academy",
			).href,
		).toBe("https://rawkode.academy/evil.com/phishing");
		expect(
			resolveCanonicalUrl(
				"\\\\evil.com/phishing",
				"/watch",
				"https://rawkode.academy",
			).href,
		).toBe("https://rawkode.academy/evil.com/phishing");

		for (const poisonedCanonical of [
			"https://evil.com/phishing",
			new URL("https://evil.com/phishing"),
			"https://evil.com@rawkode.academy/phishing",
			"javascript:alert(1)",
			"data:text/html,hi",
			"vbscript:x",
		]) {
			expect(
				resolveCanonicalUrl(
					poisonedCanonical,
					"/watch",
					"https://rawkode.academy",
				).href,
			).toBe("https://rawkode.academy/watch");
		}

		expect(
			resolveCanonicalUrl(undefined, "/watch", "not a valid url").href,
		).toBe("https://rawkode.academy/watch");
		expect(
			resolveCanonicalUrl(undefined, "/watch", "javascript:alert(1)").href,
		).toBe("https://rawkode.academy/watch");

		expect(
			resolveCanonicalUrl("watch?page=2", "/watch/", "https://rawkode.academy")
				.href,
		).toBe("https://rawkode.academy/watch?page=2");
		expect(
			resolveCanonicalUrl("watch?page=2", "/watch", "https://rawkode.academy")
				.href,
		).toBe("https://rawkode.academy/watch?page=2");
		expect(
			resolveCanonicalUrl("?page=2", "/watch/", "https://rawkode.academy").href,
		).toBe("https://rawkode.academy/watch?page=2");

		expect(
			resolveCanonicalUrl(
				"https://rawkode.academy/read?page=2",
				"/read",
				"http://localhost:4321",
			).href,
		).toBe("https://rawkode.academy/read?page=2");
		expect(
			resolveCanonicalUrl(
				"http://localhost:4321/read?page=2",
				"/read",
				"http://localhost:4321",
			).href,
		).toBe("http://localhost:4321/read?page=2");
	});

	it("Defect #1 (AstroContainer <Head>): blocks external-origin, backslash, and javascript:/data: canonical poisoning across canonical, og:url, twitter:domain, and WebPage.@id while supporting localhost Astro.site", async () => {
		const { Head } = await getCompiledComponents();

		for (const poisonedCanonical of [
			"https://evil.com/phishing",
			new URL("https://evil.com/phishing"),
			"javascript:alert(1)",
			"data:text/html,hi",
		]) {
			const rendered = await renderAstro(
				Head,
				"https://rawkode.academy/watch",
				{
					title: "Videos",
					canonicalUrl: poisonedCanonical,
				},
			);
			expect(
				rendered.dom.querySelector('link[rel="canonical"]')?.getAttribute("href"),
			).toBe("https://rawkode.academy/watch");
			expect(
				rendered.dom
					.querySelector('meta[property="og:url"]')
					?.getAttribute("content"),
			).toBe("https://rawkode.academy/watch");
			expect(
				rendered.dom
					.querySelector('meta[property="twitter:domain"]')
					?.getAttribute("content"),
			).toBe("rawkode.academy");
			const webPage = rendered.jsonLd.find(
				(item) => item["@type"] === "WebPage",
			);
			expect(webPage).toMatchObject({
				"@id": "https://rawkode.academy/watch#webpage",
				url: "https://rawkode.academy/watch",
			});
		}

		const backslashCanonical = await renderAstro(
			Head,
			"https://rawkode.academy/watch",
			{
				title: "Videos",
				canonicalUrl: "/\\evil.com/phishing",
			},
		);
		expect(
			backslashCanonical.dom
				.querySelector('link[rel="canonical"]')
				?.getAttribute("href"),
		).toBe("https://rawkode.academy/evil.com/phishing");
		expect(
			backslashCanonical.dom
				.querySelector('meta[property="twitter:domain"]')
				?.getAttribute("content"),
		).toBe("rawkode.academy");

		const trailingSlashRelative = await renderAstro(
			Head,
			"https://rawkode.academy/watch/",
			{
				title: "Videos — Page 2",
				canonicalUrl: "watch?page=2",
			},
		);
		expect(
			trailingSlashRelative.dom
				.querySelector('link[rel="canonical"]')
				?.getAttribute("href"),
		).toBe("https://rawkode.academy/watch?page=2");

		const localDevExplicitProdCanonical = await renderAstro(
			Head,
			"http://localhost:4321/read?page=2",
			{
				title: "Articles — Page 2",
				canonicalUrl: "https://rawkode.academy/read?page=2",
				pageType: "CollectionPage",
			},
			{ site: "http://localhost:4321" },
		);
		expect(
			localDevExplicitProdCanonical.dom
				.querySelector('link[rel="canonical"]')
				?.getAttribute("href"),
		).toBe("https://rawkode.academy/read?page=2");
		expect(
			localDevExplicitProdCanonical.dom
				.querySelector('meta[property="og:url"]')
				?.getAttribute("content"),
		).toBe("https://rawkode.academy/read?page=2");
		expect(
			localDevExplicitProdCanonical.dom
				.querySelector('meta[property="twitter:domain"]')
				?.getAttribute("content"),
		).toBe("rawkode.academy");
		expect(
			localDevExplicitProdCanonical.jsonLd.find(
				(item) => item["@type"] === "CollectionPage",
			)?.["@id"],
		).toBe("https://rawkode.academy/read?page=2#webpage");
	});

	it("Defect #2 (Unit): catches percent-encoded .%73%76%67 & double-encoded .%2573%2576%2567 SVGs, aligns data:image/svg+xml whitespace, blocks unsafe image schemes, and guards sub-pixel dimensions", () => {
		for (const encodedSvgUrl of [
			"https://content.rawkode.academy/logo.%73%76%67",
			"https://content.rawkode.academy/logo.%2573%2576%2567",
			"https://content.rawkode.academy/%E0%A4%A/logo.%73%76%67",
			"data:image/svg+xml ;base64,PHN2Zy8+",
			"data: image/svg+xml ; charset=utf-8 , <svg/>",
		]) {
			expect(isSvgImageUrl(encodedSvgUrl), encodedSvgUrl).toBe(true);
			expect(inferImageMimeType(encodedSvgUrl), encodedSvgUrl).toBe(
				"image/svg+xml",
			);
		}

		const rasterWithEncodedSvgQuery =
			"https://content.rawkode.academy/covers/hero.png?source=logo.%73%76%67";
		expect(isSvgImageUrl(rasterWithEncodedSvgQuery)).toBe(false);
		expect(inferImageMimeType(rasterWithEncodedSvgQuery)).toBe("image/png");
		expect(
			resolveOpenGraphImage({
				title: "Raster Cover",
				image: { image: rasterWithEncodedSvgQuery },
				pageUrl: new URL("https://rawkode.academy/read/test"),
				useImageDirectly: true,
			}),
		).toEqual({
			url: rasterWithEncodedSvgQuery,
			alt: "Raster Cover",
			type: "image/png",
		});

		for (const encodedRemoteSvg of [
			"https://content.rawkode.academy/logo.%73%76%67",
			"https://content.rawkode.academy/logo.%2573%2576%2567",
		]) {
			const resolved = resolveOpenGraphImage({
				title: "Test Title",
				image: { image: encodedRemoteSvg },
				pageUrl: new URL("https://rawkode.academy/read/test"),
				useImageDirectly: true,
			});
			expect(resolved.url.startsWith(`${IMAGE_SERVICE_URL}?`)).toBe(true);
			expect(resolved.type).toBe("image/png");
			expect(resolved.width).toBe(OPEN_GRAPH_IMAGE_WIDTH);
			expect(resolved.height).toBe(OPEN_GRAPH_IMAGE_HEIGHT);
			expect(decodePayloadFromOgUrl(resolved.url)).toMatchObject({
				format: "png",
				image: encodedRemoteSvg,
			});
		}

		for (const dataImageUri of [
			"data:image/svg+xml ;base64,PHN2Zy8+",
			"data:image/png;base64,iVBORw0KGgo=",
		]) {
			const resolved = resolveOpenGraphImage({
				title: "Data Image",
				image: { image: dataImageUri },
				pageUrl: new URL("https://rawkode.academy/read/test"),
				useImageDirectly: true,
			});
			expect(resolved.url.startsWith(`${IMAGE_SERVICE_URL}?`)).toBe(true);
			expect(resolved.type).toBe("image/png");
			expect(decodePayloadFromOgUrl(resolved.url)).not.toHaveProperty("image");
		}

		for (const unsafeImageInput of [
			"javascript:alert(1)",
			new URL("javascript:alert(1)"),
			"vbscript:x",
			"file:///etc/passwd",
			"mailto:ops@rawkode.academy",
			"data:text/html,hi",
		]) {
			for (const useDirect of [true, false]) {
				const resolved = resolveOpenGraphImage({
					title: "Safe Share Card",
					image: { image: unsafeImageInput },
					pageUrl: new URL("https://rawkode.academy/read/test"),
					useImageDirectly: useDirect,
				});
				expect(resolved.url.startsWith(`${IMAGE_SERVICE_URL}?`)).toBe(true);
				expect(resolved.type).toBe("image/png");
				expect(decodePayloadFromOgUrl(resolved.url)).not.toHaveProperty(
					"image",
				);
			}
		}

		for (const [invalidWidth, invalidHeight] of [
			[0.4, 0.2],
			[0, -5],
			[Number.NaN, Number.POSITIVE_INFINITY],
		] as const) {
			const resolved = resolveOpenGraphImage({
				title: "Sub-pixel Cover",
				image: {
					image: "https://content.rawkode.academy/articles/cover.webp",
					width: invalidWidth,
					height: invalidHeight,
				},
				pageUrl: new URL("https://rawkode.academy/read/sub-pixel"),
				useImageDirectly: true,
			});
			expect(resolved).toEqual({
				url: "https://content.rawkode.academy/articles/cover.webp",
				alt: "Sub-pixel Cover",
				type: "image/webp",
			});
		}
	});

	it("Defect #2 (AstroContainer <Head>): never emits javascript: og:image, raw percent-encoded .%73%76%67, or sub-pixel og:image:width='0' in rendered HTML", async () => {
		const { Head } = await getCompiledComponents();

		for (const useDirect of [true, false]) {
			const jsImageRender = await renderAstro(
				Head,
				"https://rawkode.academy/read/test",
				{
					title: "Safe Image Test",
					image: { image: "javascript:alert(1)" },
					useImageDirectly: useDirect,
				},
			);
			const ogImage =
				jsImageRender.dom
					.querySelector('meta[property="og:image"]')
					?.getAttribute("content") ?? "";
			expect(ogImage.startsWith(`${IMAGE_SERVICE_URL}?`)).toBe(true);
			expect(
				jsImageRender.dom
					.querySelector('meta[name="twitter:image"]')
					?.getAttribute("content"),
			).toBe(ogImage);
			expect(decodePayloadFromOgUrl(ogImage)).not.toHaveProperty("image");
			expect(jsImageRender.html).not.toContain("javascript:alert(1)");
		}

		const encodedSvgRender = await renderAstro(
			Head,
			"https://rawkode.academy/technology/kubernetes",
			{
				title: "Kubernetes",
				image: { image: "https://content.rawkode.academy/logo.%73%76%67" },
				useImageDirectly: true,
			},
		);
		const svgFallbackUrl =
			encodedSvgRender.dom
				.querySelector('meta[property="og:image"]')
				?.getAttribute("content") ?? "";
		expect(svgFallbackUrl.startsWith(`${IMAGE_SERVICE_URL}?`)).toBe(true);
		expect(
			encodedSvgRender.dom
				.querySelector('meta[property="og:image:type"]')
				?.getAttribute("content"),
		).toBe("image/png");
		expect(
			encodedSvgRender.dom
				.querySelector('meta[property="og:image:width"]')
				?.getAttribute("content"),
		).toBe("1200");
		expect(
			encodedSvgRender.dom
				.querySelector('meta[property="og:image:height"]')
				?.getAttribute("content"),
		).toBe("630");

		const subPixelRender = await renderAstro(
			Head,
			"https://rawkode.academy/read/sub-pixel",
			{
				title: "Sub-pixel Cover",
				image: {
					image: "https://content.rawkode.academy/articles/cover.webp",
					width: 0.4,
					height: 0.2,
				},
				useImageDirectly: true,
			},
		);
		expect(
			subPixelRender.dom
				.querySelector('meta[property="og:image"]')
				?.getAttribute("content"),
		).toBe("https://content.rawkode.academy/articles/cover.webp");
		expect(
			subPixelRender.dom
				.querySelector('meta[property="og:image:type"]')
				?.getAttribute("content"),
		).toBe("image/webp");
		expect(
			subPixelRender.dom.querySelector('meta[property="og:image:width"]'),
		).toBeNull();
		expect(
			subPixelRender.dom.querySelector('meta[property="og:image:height"]'),
		).toBeNull();
		expect(subPixelRender.html).not.toContain('content="0"');
	});
});

