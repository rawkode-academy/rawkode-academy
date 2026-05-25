#!/usr/bin/env -S deno run --allow-net
/*
  Check sitemap URLs for status 200 and canonical correctness.
  Usage: deno run --allow-net scripts/check-sitemap.ts --base https://rawkode.academy [--limit 400] [--concurrency 10]
*/
import { flagValue, integerFlag } from "./lib/args.ts";
import { normalizeUrl } from "./lib/url.ts";

type Args = {
	base: string;
	limit: number;
	concurrency: number;
};

type SitemapFetchResult = {
	indexUrl: string;
	sitemapLocs: string[];
	pageUrls: string[];
};

type UrlExpectation = {
	url: string;
	expectedCanonical: string;
	expectedRobots?: string;
};

type SupplementalUrlCheck = {
	path: string;
	expectedCanonicalPath: string;
	expectedRobots?: string;
};

type UrlCheckResult = {
	url: string;
	ok: boolean;
	canonical: string | null;
	canonicalOk: boolean;
	hostOk: boolean;
	robots: string | null;
	robotsOk: boolean;
	status: number;
};

type SupplementalUrlCheckResult = UrlCheckResult & {
	expectedRobots: string | null;
};

type PageCheckResult = {
	pageResults: UrlCheckResult[];
	pageErrorCount: number;
};

type SitemapIssues = {
	missingSitemaps: string[];
	disallowedSitemapUrls: string[];
};

type RunSummary = SitemapIssues & PageCheckResult & {
	supplementalResults: SupplementalUrlCheckResult[];
	supplementalFailures: SupplementalUrlCheckResult[];
	pageFailures: UrlCheckResult[];
};

export const REQUIRED_SITEMAP_PATHS = [
	"/sitemaps/pages.xml",
	"/sitemaps/articles.xml",
	"/sitemaps/technologies.xml",
	"/video-sitemap.xml",
	"/sitemaps/courses.xml",
	"/sitemaps/learning-paths.xml",
	"/sitemaps/people.xml",
	"/sitemaps/shows.xml",
	"/sitemaps/series.xml",
	"/sitemaps/news.xml",
	"/news-sitemap.xml",
	"/sitemaps/adrs.xml",
] as const;

const DISALLOWED_SITEMAP_PATH_PREFIXES = [
	"/admin",
	"/private",
	"/settings",
	"/confirm-subscription",
	"/unsubscribe",
	"/_server-islands/",
	"/api/",
	"/graphql",
] as const;

export const SUPPLEMENTAL_URL_CHECKS: readonly SupplementalUrlCheck[] = [
	{
		path: "/watch",
		expectedCanonicalPath: "/watch",
	},
	{
		path: "/watch?page=2",
		expectedCanonicalPath: "/watch",
		expectedRobots: "noindex,follow",
	},
] as const;

function parseArgs(): Args {
	const argv = Deno.args;
	return {
		base: flagValue(argv, "--base", "https://rawkode.academy")!,
		limit: integerFlag(argv, "--limit", 400),
		concurrency: integerFlag(argv, "--concurrency", 10),
	};
}

async function fetchText(url: string) {
	const response = await fetch(url, { headers: { Accept: "*/*" } });
	if (!response.ok) {
		throw new Error(`${response.status} ${response.statusText}`);
	}
	return await response.text();
}

function extractLocsFromXml(xml: string): string[] {
	const locs: string[] = [];
	const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
	let match: RegExpExecArray | null;

	while ((match = re.exec(xml))) {
		const loc = match[1];
		if (typeof loc === "string") {
			locs.push(loc.trim());
		}
	}

	return locs;
}

function extractTagAttribute(
	html: string,
	tagName: string,
	requiredAttributes: Record<string, string>,
	targetAttribute: string,
): string | null {
	const tagPattern = new RegExp(`<${tagName}\\b[^>]*>`, "gi");

	for (const match of html.matchAll(tagPattern)) {
		const tag = match[0];
		const hasRequiredAttributes = Object.entries(requiredAttributes).every(
			([name, value]) =>
				new RegExp(`${name}\\s*=\\s*["']${value}["']`, "i").test(tag),
		);
		if (!hasRequiredAttributes) continue;

		const targetMatch = tag.match(
			new RegExp(`${targetAttribute}\\s*=\\s*["']([^"']+)["']`, "i"),
		);
		if (targetMatch?.[1]) return targetMatch[1];
	}

	return null;
}

function normalizeRobots(robots: string | null): string | null {
	return robots?.replace(/\s+/g, "").toLowerCase() ?? null;
}

export function buildSupplementalUrlChecks(base: string): UrlExpectation[] {
	return SUPPLEMENTAL_URL_CHECKS.map((check) => ({
		url: new URL(check.path, base).href,
		expectedCanonical: new URL(check.expectedCanonicalPath, base).href,
		...(check.expectedRobots
			? {
				expectedRobots: check.expectedRobots,
			}
			: {}),
	}));
}

async function readChildSitemapUrls(sitemapLocs: string[]): Promise<string[]> {
	const pageUrls: string[] = [];

	for (const loc of sitemapLocs) {
		try {
			pageUrls.push(...extractLocsFromXml(await fetchText(loc)));
		} catch (error) {
			console.warn(`Failed to read child sitemap ${loc}:`, error);
		}
	}

	return Array.from(new Set(pageUrls));
}

async function getSitemapFetchResult(
	base: string,
): Promise<SitemapFetchResult> {
	const candidates = [
		new URL("/sitemap-index.xml", base).href,
		new URL("/sitemap.xml", base).href,
	];

	for (const sitemapUrl of candidates) {
		try {
			const xml = await fetchText(sitemapUrl);
			const locs = extractLocsFromXml(xml);
			if (locs.length === 0) continue;

			const looksLikeIndex = xml.includes("<sitemapindex") ||
				locs.some((loc) => /sitemap.*\.xml/i.test(loc));
			const sitemapLocs = looksLikeIndex
				? Array.from(new Set(locs))
				: [sitemapUrl];

			return {
				indexUrl: sitemapUrl,
				sitemapLocs,
				pageUrls: looksLikeIndex
					? await readChildSitemapUrls(sitemapLocs)
					: Array.from(new Set(locs)),
			};
		} catch {
			continue;
		}
	}

	throw new Error("Could not fetch sitemap index or sitemap.xml");
}

function pageMetadata(
	html: string,
): Pick<UrlCheckResult, "canonical" | "robots"> {
	return {
		canonical: extractTagAttribute(html, "link", { rel: "canonical" }, "href"),
		robots: extractTagAttribute(html, "meta", { name: "robots" }, "content"),
	};
}

function canonicalStatus(
	canonical: string | null,
	expectedCanonical: string,
	apexHost: string,
): Pick<UrlCheckResult, "canonicalOk" | "hostOk"> {
	if (!canonical) {
		return { canonicalOk: false, hostOk: false };
	}
	return {
		canonicalOk: normalizeUrl(canonical) === normalizeUrl(expectedCanonical),
		hostOk: new URL(canonical).hostname.replace(/^www\./, "") === apexHost,
	};
}

function robotsStatus(robots: string | null, expectedRobots?: string): boolean {
	return expectedRobots == null ||
		normalizeRobots(robots) === normalizeRobots(expectedRobots);
}

function uncheckedUrlResult(url: string, status: number): UrlCheckResult {
	return {
		url,
		ok: status === 200,
		canonical: null,
		canonicalOk: false,
		hostOk: false,
		robots: null,
		robotsOk: true,
		status,
	};
}

async function checkUrl(
	url: string,
	apexHost: string,
	expectation?: UrlExpectation,
): Promise<UrlCheckResult> {
	const response = await fetch(url, { headers: { Accept: "text/html" } });
	const contentType = response.headers.get("content-type") || "";
	if (response.status !== 200 || !contentType.includes("text/html")) {
		return uncheckedUrlResult(url, response.status);
	}

	const metadata = pageMetadata(await response.text());
	const expectedCanonical = expectation?.expectedCanonical ?? url;
	return {
		...uncheckedUrlResult(url, response.status),
		...metadata,
		...canonicalStatus(metadata.canonical, expectedCanonical, apexHost),
		robotsOk: robotsStatus(metadata.robots, expectation?.expectedRobots),
	};
}

function findSitemapIssues(
	sitemapLocs: string[],
	pageUrls: string[],
): SitemapIssues {
	const sitemapPaths = new Set(sitemapLocs.map((loc) => new URL(loc).pathname));
	return {
		missingSitemaps: REQUIRED_SITEMAP_PATHS.filter(
			(path) => !sitemapPaths.has(path),
		),
		disallowedSitemapUrls: pageUrls.filter((url) => {
			const pathname = new URL(url).pathname;
			return DISALLOWED_SITEMAP_PATH_PREFIXES.some((prefix) =>
				pathname.startsWith(prefix)
			);
		}),
	};
}

function logPageResult(result: UrlCheckResult) {
	const indicator = result.ok && result.canonicalOk && result.hostOk
		? "OK"
		: "WARN";
	console.log(`${indicator} ${result.url} [${result.status}]`);
}

async function checkPageUrls(
	urls: string[],
	concurrency: number,
	apexHost: string,
): Promise<PageCheckResult> {
	const pageResults: UrlCheckResult[] = [];
	let pageErrorCount = 0;
	let pageIndex = 0;

	async function worker() {
		while (pageIndex < urls.length) {
			const url = urls[pageIndex++];
			if (!url) continue;

			try {
				const result = await checkUrl(url, apexHost);
				pageResults.push(result);
				logPageResult(result);
			} catch (error) {
				pageErrorCount += 1;
				console.log(`FAIL ${url} -> ${error}`);
			}
		}
	}

	await Promise.all(Array.from({ length: concurrency }, worker));
	return { pageResults, pageErrorCount };
}

async function checkSupplementalUrls(
	base: string,
	apexHost: string,
): Promise<SupplementalUrlCheckResult[]> {
	return await Promise.all(
		buildSupplementalUrlChecks(base).map((check) =>
			checkUrl(check.url, apexHost, check).then((result) => ({
				...result,
				expectedRobots: check.expectedRobots ?? null,
			}))
		),
	);
}

function printList(title: string, items: string[]) {
	if (items.length === 0) return;
	console.log(title);
	for (const item of items) {
		console.log(`  - ${item}`);
	}
}

function printSupplementalResults(results: SupplementalUrlCheckResult[]) {
	if (results.length === 0) return;
	console.log("\nSupplemental checks:");

	for (const result of results) {
		const indicator =
			result.ok && result.canonicalOk && result.hostOk && result.robotsOk
				? "OK"
				: "WARN";
		console.log(
			`  ${indicator} ${result.url} [${result.status}] canonical=${
				result.canonical ?? "missing"
			} robots=${result.robots ?? "missing"}`,
		);
	}
}

function summarize(
	pageResults: UrlCheckResult[],
	pageErrorCount: number,
	issues: SitemapIssues,
	supplementalResults: SupplementalUrlCheckResult[],
): RunSummary {
	const pageFailures = pageResults.filter(
		(result) => !result.ok || !result.canonicalOk || !result.hostOk,
	);
	const supplementalFailures = supplementalResults.filter(
		(result) =>
			!result.ok || !result.canonicalOk || !result.hostOk || !result.robotsOk,
	);

	return {
		...issues,
		pageResults,
		pageErrorCount,
		supplementalResults,
		pageFailures,
		supplementalFailures,
	};
}

function printSummary(summary: RunSummary) {
	console.log("\nSummary:");
	console.log(`  Total sitemap URLs checked: ${summary.pageResults.length}`);
	console.log(
		`  Required sitemap files missing: ${summary.missingSitemaps.length}`,
	);
	console.log(
		`  Disallowed URLs in sitemap set: ${summary.disallowedSitemapUrls.length}`,
	);
	console.log(`  Canonical/page failures: ${summary.pageFailures.length}`);
	console.log(`  Page fetch errors: ${summary.pageErrorCount}`);
	console.log(
		`  Supplemental URL failures: ${summary.supplementalFailures.length}`,
	);

	printList("\nMissing required sitemap files:", summary.missingSitemaps);
	printList(
		"\nDisallowed URLs present in sitemap set:",
		summary.disallowedSitemapUrls,
	);
	printSupplementalResults(summary.supplementalResults);
}

function hasBlockingFailures(summary: RunSummary): boolean {
	return summary.missingSitemaps.length > 0 ||
		summary.disallowedSitemapUrls.length > 0 ||
		summary.pageFailures.length > 0 ||
		summary.pageErrorCount > 0 ||
		summary.supplementalFailures.length > 0;
}

async function run() {
	const { base, limit, concurrency } = parseArgs();
	const apexHost = new URL(base).hostname.replace(/^www\./, "");

	console.log(
		`Checking sitemap for ${base} (limit=${limit}, concurrency=${concurrency})`,
	);

	const { indexUrl, sitemapLocs, pageUrls } = await getSitemapFetchResult(base);
	console.log(`Fetched sitemap index: ${indexUrl}`);
	console.log(
		`Found ${sitemapLocs.length} child sitemaps and ${pageUrls.length} URLs`,
	);

	const pageCheck = await checkPageUrls(
		pageUrls.slice(0, limit),
		concurrency,
		apexHost,
	);
	const summary = summarize(
		pageCheck.pageResults,
		pageCheck.pageErrorCount,
		findSitemapIssues(sitemapLocs, pageUrls),
		await checkSupplementalUrls(base, apexHost),
	);

	printSummary(summary);
	if (hasBlockingFailures(summary)) {
		Deno.exit(2);
	}
}

if (import.meta.main) {
	run().catch((error) => {
		console.error("Failed:", error);
		Deno.exit(1);
	});
}
