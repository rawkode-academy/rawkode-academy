import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { transform } from "@astrojs/compiler";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isNewsPublished } from "../lib/news-publication";
import { selectRelatedNews } from "../lib/related-news";
import { buildNewsItemListJsonLd } from "../lib/news-itemlist-jsonld";
import { buildNewsArticleJsonLd } from "../lib/news-jsonld";

const now = new Date("2026-09-20T18:00:00Z");
const story = (id: string, publishedAt: Date, technologies: string[] = []) => ({
	id,
	data: { title: id, description: `About ${id}`, publishedAt, technologies },
});
const published = story("published", new Date("2026-01-01"), ["kubernetes"]);
const boundary = story("boundary", now);
const future = story("future", new Date(now.getTime() + 1), ["kubernetes"]);
const invalid = story("invalid", new Date(Number.NaN), ["kubernetes"]);
const fixtures = [future, invalid, published, boundary];

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
});
afterEach(() => {
	vi.useRealTimers();
	expect(fetch).not.toHaveBeenCalled();
});

// Execute the actual route declarations with only the collection boundary mocked.
// This fails if a route drops its filter, rather than merely retesting a helper.
// The mocked live layer does not hide scheduled stories the way the real one
// does, so the routes' own publication checks are what is under test.
async function routeData(
	file: string,
	names: string[],
	result: string,
	entries = fixtures,
	slug?: string,
) {
	const text = readFileSync(`src/pages/news/${file}`, "utf8");
	const source = ts.createSourceFile(
		file,
		text.split("---")[1]!,
		ts.ScriptTarget.Latest,
		true,
	);
	const declarations = source.statements.filter(
		(statement) =>
			ts.isVariableStatement(statement) &&
			statement.declarationList.declarations.some(
				(declaration) =>
					ts.isIdentifier(declaration.name) &&
					names.includes(declaration.name.text),
			),
	);
	expect(declarations).toHaveLength(names.length);
	const code = ts.transpileModule(
		declarations
			.map((s) => s.getText(source).replace(/^export\s+/, ""))
			.join("\n"),
		{
			compilerOptions: {
				target: ts.ScriptTarget.ES2022,
				module: ts.ModuleKind.ESNext,
			},
		},
	).outputText;
	const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
	return new AsyncFunction(
		"getCollection",
		"getEntry",
		"isNewsPublished",
		"Astro",
		`${code}\nreturn ${result};`,
	)(
		async (
			collection: string,
			filter?: (entry: typeof published) => boolean,
		) => {
			expect(collection).toBe("news");
			return entries.filter(filter ?? (() => true));
		},
		async (collection: string, id: string) => {
			expect(collection).toBe("news");
			return entries.find((entry) => entry.id === id);
		},
		isNewsPublished,
		{ params: { slug } },
	);
}

/** The story the detail route would render for a slug (undefined → 404). */
async function detailStory(slug: string, entries = fixtures) {
	return routeData(
		"[...slug].astro",
		["now", "entry", "article"],
		"article",
		entries,
		slug,
	);
}

function frontmatter(file: string): string {
	return readFileSync(`src/pages/news/${file}`, "utf8").split("---")[1]!;
}

describe("News publication eligibility", () => {
	it("compares against request time, so a scheduled story appears without a deploy", () => {
		const scheduled = new Date(now.getTime() + 60_000);
		expect(isNewsPublished(scheduled)).toBe(false);
		vi.setSystemTime(now.getTime() + 60_000);
		expect(isNewsPublished(scheduled)).toBe(true);
		expect(isNewsPublished(scheduled, now)).toBe(false);
		expect(isNewsPublished(new Date(Number.NaN))).toBe(false);
	});
	it("admits a finite date at the boundary, but not future or invalid dates", () => {
		expect(
			fixtures
				.filter((entry) => isNewsPublished(entry.data.publishedAt, now))
				.map((entry) => entry.id),
		).toEqual(["published", "boundary"]);
	});
	it("serves only published stories from the actual server-rendered detail route", async () => {
		const served: string[] = [];
		for (const entry of [...fixtures, story("unknown", now)]) {
			const slug = entry.id;
			const article = await detailStory(slug, fixtures);
			if (article) {
				expect(article.id).toBe(slug);
				served.push(slug);
			}
		}
		expect(served).toEqual(["published", "boundary"]);
		const source = frontmatter("[...slug].astro");
		expect(source).toContain("export const prerender = false;");
		expect(source).not.toContain("getStaticPaths");
		expect(source).toContain(
			"if (!article) return new Response(null, { status: 404 });",
		);
	});
	it("caches both routes on the news collection so scheduled stories appear on time", () => {
		for (const file of ["index.astro", "[...slug].astro"]) {
			const source = frontmatter(file);
			expect(source).toContain("export const prerender = false;");
			expect(source).toMatch(
				/await setContentCache\(Astro, \{[\s\S]*?collections: \[[^\]]*"news"/,
			);
			expect(source).not.toContain("astro:content");
		}
	});
	it("excludes them from the archive's actual lead/list and JSON-LD input", async () => {
		const stories = await routeData(
			"index.astro",
			["now", "allNews"],
			"allNews",
		);
		expect(stories.map((entry: typeof published) => entry.id)).toEqual([
			"boundary",
			"published",
		]);
		expect(readFileSync("src/pages/news/index.astro", "utf8")).toContain(
			"<NewsItemListJsonLd stories={allNews}",
		);
		const metadata = buildNewsItemListJsonLd(
			{
				stories: fixtures,
				siteUrl: "https://example.test",
				listUrl: "https://example.test/news",
			},
			now,
		);
		expect(metadata.numberOfItems).toBe(2);
		expect(JSON.stringify(metadata)).not.toMatch(/future|invalid/);
	});
	it("filters before related ranking/limiting in tagged and untagged cases", () => {
		for (const technologies of [[], ["kubernetes"]]) {
			const result = selectRelatedNews(
				"current",
				technologies,
				fixtures,
				2,
				now,
			);
			expect(result.map((entry) => entry.id)).toEqual(
				technologies.length
					? ["published", "boundary"]
					: ["boundary", "published"],
			);
		}
		expect(
			selectRelatedNews("published", ["kubernetes"], fixtures, 3, now),
		).toEqual([boundary]);
	});
	it("retains every currently published authored News URL", async () => {
		const entries = AUTHORED_NEWS.map(([id, publishedAt]) =>
			story(id, new Date(publishedAt)),
		);
		expect(entries).toHaveLength(37);
		const served: string[] = [];
		for (const entry of entries) {
			if (await detailStory(entry.id, entries)) served.push(entry.id);
		}
		const publishedIds = entries
			.filter((entry) => entry.data.publishedAt <= now)
			.map((entry) => entry.id);
		expect(publishedIds.length).toBeGreaterThan(0);
		expect(served.sort()).toEqual(publishedIds.sort());
	});
	it.each([
		"index.astro",
		"[...slug].astro",
	])("compiles %s without diagnostics", async (file) => {
		const source = readFileSync(`src/pages/news/${file}`, "utf8");
		expect((await transform(source)).diagnostics).toEqual([]);
		// Astro 7 builds with the Rust compiler; it must accept the route too.
		const fromAstro = createRequire(
			createRequire(import.meta.url).resolve("astro/package.json"),
		);
		const rs: {
			transform(
				input: string,
				options: { filename: string },
			): { diagnostics: { severity: string; text?: string }[] };
		} = await import(fromAstro.resolve("@astrojs/compiler-rs"));
		expect(
			rs
				.transform(source, { filename: file })
				.diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
		).toEqual([]);
	});
	it("omits unsupported speakable metadata without removing real article identity", () => {
		const metadata = buildNewsArticleJsonLd({
			article: published.data,
			authors: [{ name: "Reporter" }],
			url: "https://example.test/news/published",
			imageUrl: "https://example.test/og.png",
			siteUrl: "https://example.test",
		});
		expect(metadata).not.toHaveProperty("speakable");
		expect(metadata.headline).toBe("published");
		expect(metadata.datePublished).toBe(
			published.data.publishedAt.toISOString(),
		);
		expect(metadata.author).toEqual([{ "@type": "Person", name: "Reporter" }]);
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
