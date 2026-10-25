// Compares a website build against production, route by route. Feeds,
// sitemaps, text and .md endpoints must be byte-identical; pages are compared
// by the structure of <main>: headings, text and link targets.
//
//   bun scripts/compare-routes.ts <candidate origin> [<baseline origin>] [--out <dir>]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: { out: { type: "string" } },
});
const [candidate, baseline = "https://rawkode.academy"] = positionals;
if (!candidate) throw new Error("usage: compare-routes.ts <candidate origin> [<baseline origin>] [--out <dir>]");

const BYTES = [
	"/api/feeds/all.xml",
	"/api/feeds/all.atom",
	"/api/feeds/all.json",
	"/api/feeds/articles.xml",
	"/api/feeds/articles.atom",
	"/api/feeds/articles.json",
	"/api/feeds/news.xml",
	"/api/feeds/news.atom",
	"/api/feeds/news.json",
	"/api/feeds/videos.xml",
	"/api/feeds/videos.atom",
	"/api/feeds/videos.json",
	"/api/feeds/people/rawkode.xml",
	"/api/feeds/shows/rawkode-live.xml",
	"/api/feeds/shows/cloud-native-compass.xml",
	"/api/feeds/shows/klustered.xml",
	"/api/feeds/technology/kubernetes.xml",
	"/api/feeds/technology/rust.xml",
	"/feeds.opml",
	"/sitemap-index.xml",
	"/sitemaps/adrs.xml",
	"/sitemaps/articles.xml",
	"/sitemaps/courses.xml",
	"/sitemaps/learning-paths.xml",
	"/sitemaps/news.xml",
	"/sitemaps/pages.xml",
	"/sitemaps/people.xml",
	"/sitemaps/shows.xml",
	"/sitemaps/technologies.xml",
	"/news-sitemap.xml",
	"/video-sitemap.xml",
	"/llms.txt",
	"/llms-full.txt",
	"/robots.txt",
	"/opensearch.xml",
	"/read/klustered-winter-2026.md",
	"/read/kubernetes-operators-rust-kube-rs.md",
	"/read/zed-show-and-tell.md",
	"/read/kyverno-cel-validating-policy.md",
	"/watch/hands-on-introduction-to-swamp-club.md",
	"/watch/ambient-mesh-with-marino-wijay-and-matt-turner.md",
	"/watch/chevron7-2026-01-23.md",
];

const PAGES = [
	"/",
	"/read",
	"/read/klustered-winter-2026",
	"/read/kubernetes-operators-rust-kube-rs",
	"/read/zed-show-and-tell",
	"/read/kyverno-cel-validating-policy",
	"/read/how-to-ask-for-help",
	"/read/our-architecture",
	"/news",
	"/news/kyverno-graduates-cncf",
	"/news/kubernetes-1-36-sneak-peek",
	"/changelog",
	"/adrs",
	"/adrs/0001-adopt-adrs",
	"/adrs/0002-adopt-bun",
	"/courses",
	"/courses/complete-guide-zitadel",
	"/courses/complete-guide-zitadel/01-introduction",
	"/courses/teleport-for-kubernetes",
	"/courses/teleport-for-kubernetes/01-introduction",
	"/learning-paths",
	"/learning-paths/gitops-landscape",
	"/watch",
	"/watch/hands-on-introduction-to-swamp-club",
	"/watch/ambient-mesh-with-marino-wijay-and-matt-turner",
	"/watch/chevron7-2026-01-23",
	"/shows",
	"/shows/cloud-native-compass",
	"/shows/klustered",
	"/shows/rawkode-live",
	"/technology",
	"/technology/kubernetes",
	"/technology/swamp",
	"/technology/rust",
	"/technology/matrix",
	"/people",
	"/people/rawkode",
	"/people/nickstinemates",
	"/about",
	"/organizations",
	"/feeds",
	"/maintainers/share-your-project",
];

type Fetched = { status: number; type: string; body: string };
async function get(origin: string, path: string): Promise<Fetched> {
	const response = await fetch(new URL(path, origin), { redirect: "manual", headers: { "cache-control": "no-cache" } });
	return { status: response.status, type: response.headers.get("content-type") ?? "", body: await response.text() };
}

// The origin the candidate serves from appears in some absolute URLs.
const normalizeOrigin = (body: string) => body.replaceAll(new URL(candidate).origin, "https://rawkode.academy");

// A sitemap or feed stamps entries without a date of their own with the build
// time; that value differs on every deploy. It is the timestamp most entries share.
function maskBuildTime(body: string): string {
	const stamps = [...body.matchAll(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z/g)].map((m) => m[0]);
	const counts = new Map<string, number>();
	for (const stamp of stamps) counts.set(stamp, (counts.get(stamp) ?? 0) + 1);
	const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
	return n > 3 ? body.replaceAll(top, "<build-time>") : body;
}

// An image is the file it shows: Astro's /_astro/<name>.<hash>.<ext> for a
// bundled image, /_image?href=<remote url> for one on the content CDN.
function imageName(src: string): string {
	const decoded = decode(src);
	const href = decoded.match(/[?&]href=([^&]+)/)?.[1];
	const path = href ? decodeURIComponent(href) : decoded;
	const file = path.split("?")[0]?.split("/").pop() ?? path;
	// Astro: <name>.<content hash>_<transform hash>.<ext>
	return file.replace(/\.(png|jpe?g|webp|avif|gif|svg)$/i, "").replace(/\.[A-Za-z0-9_-]{8}(?:_[A-Za-z0-9_-]{4,8})?$/, "");
}

// <main> as headings, links, images, diagrams and normalised text, read with
// HTMLRewriter (attribute values such as `[&_>_*]` defeat regexes).
async function structure(html: string): Promise<string[]> {
	const out: string[] = [];
	let inMain = 0;
	let skip = 0;
	let heading: { tag: string; text: string } | undefined;
	let text = "";
	const rewriter = new HTMLRewriter()
		.on("main", {
			element(el) {
				inMain++;
				el.onEndTag(() => {
					inMain--;
				});
			},
		})
		.on("script, style, template, svg", {
			element(el) {
				if (!inMain) return;
				if (el.tagName === "svg") out.push("svg");
				skip++;
				el.onEndTag(() => {
					skip--;
				});
			},
		})
		.on("h1, h2, h3, h4, h5, h6", {
			element(el) {
				if (!inMain || skip) return;
				heading = { tag: el.tagName, text: "" };
				el.onEndTag(() => {
					if (heading) out.push(`${heading.tag}: ${squash(heading.text)}`);
					heading = undefined;
				});
			},
		})
		.on("a[href]", {
			element(el) {
				if (inMain && !skip) out.push(`link: ${decode(el.getAttribute("href") ?? "")}`);
			},
		})
		.on("img[src]", {
			element(el) {
				if (inMain && !skip) out.push(`img: ${imageName(el.getAttribute("src") ?? "")}`);
			},
		})
		.on("*", {
			text(chunk) {
				if (!inMain || skip) return;
				text += chunk.text;
				if (heading) heading.text += chunk.text;
			},
		});
	await rewriter.transform(new Response(html)).text();
	// Whitespace between elements differs between static and on-demand renders.
	out.push(`text: ${decode(text).replace(/\s+/g, "")}`);
	return out;
}
const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const decode = (s: string) =>
	s
		.replace(/&nbsp;/g, " ")
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&#x27;/g, "'");

function lineDiff(a: string, b: string, limit = 12): string[] {
	const al = a.split("\n");
	const bl = b.split("\n");
	const out: string[] = [];
	const bset = new Set(bl);
	const aset = new Set(al);
	for (const line of al) if (!bset.has(line) && out.length < limit) out.push(`- ${line.slice(0, 220)}`);
	for (const line of bl) if (!aset.has(line) && out.length < limit * 2) out.push(`+ ${line.slice(0, 220)}`);
	return out;
}

const report: string[] = [];
let identical = 0;
const differences: string[] = [];
const out = values.out;
if (out) mkdirSync(out, { recursive: true });

async function compare(path: string, mode: "bytes" | "structure") {
	const [base, cand] = await Promise.all([get(baseline, path), get(candidate, path)]);
	const a = maskBuildTime(base.body);
	const b = maskBuildTime(normalizeOrigin(cand.body));
	let same: boolean;
	let detail: string[] = [];
	if (base.status !== cand.status) {
		same = false;
		detail = [`status ${base.status} -> ${cand.status}`];
	} else if (mode === "bytes") {
		same = a === b;
		if (!same) detail = lineDiff(a, b);
	} else {
		const sa = await structure(a);
		const sb = await structure(b);
		same = JSON.stringify(sa) === JSON.stringify(sb);
		if (!same) {
			detail = lineDiff(sa.filter((l) => !l.startsWith("text: ")).join("\n"), sb.filter((l) => !l.startsWith("text: ")).join("\n"));
			const ta = sa.at(-1) ?? "";
			const tb = sb.at(-1) ?? "";
			if (ta !== tb) {
				let i = 0;
				while (i < ta.length && ta[i] === tb[i]) i++;
				detail.push(`text @${i}: - ${ta.slice(Math.max(0, i - 40), i + 100)}`, `          + ${tb.slice(Math.max(0, i - 40), i + 100)}`);
			}
		}
	}
	if (same) identical++;
	else differences.push(path);
	report.push(`${same ? "SAME" : "DIFF"} ${mode.padEnd(9)} ${base.status} ${path}${detail.length ? `\n    ${detail.join("\n    ")}` : ""}`);
	if (out && !same) {
		const name = path.replace(/[^a-z0-9.-]+/gi, "_");
		writeFileSync(join(out, `${name}.baseline`), a);
		writeFileSync(join(out, `${name}.candidate`), b);
	}
}

const jobs = [...BYTES.map((p) => [p, "bytes"] as const), ...PAGES.map((p) => [p, "structure"] as const)];
const queue = [...jobs];
await Promise.all(
	Array.from({ length: 2 }, async () => {
		for (let job = queue.shift(); job; job = queue.shift()) await compare(job[0], job[1]);
	}),
);
report.sort((x, y) => x.slice(5).localeCompare(y.slice(5)));
console.log(report.join("\n"));
console.log(`\n${jobs.length} routes: ${identical} identical, ${differences.length} differ`);
