#!/usr/bin/env bun
/*
  Check sitemap URLs for status 200 and canonical correctness.
  Usage: bun scripts/check-sitemap.ts --base https://rawkode.academy [--limit 400] [--concurrency 10]
*/

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
	"/sitemaps/adrs.xml",
] as const;

export const DISALLOWED_SITEMAP_PATH_PREFIXES = [
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
	const argv = process.argv.slice(2);
	const get = (flag: string) => {
		const i = argv.indexOf(flag);
		return i !== -1 ? argv[i + 1] : undefined;
	};
	const base = get("--base") || "https://rawkode.academy";
	const limit = parseInt(get("--limit") || "400", 10);
	const concurrency = parseInt(get("--concurrency") || "10", 10);
	return { base, limit, concurrency };
}

async function fetchText(url: string) {
	const response = await fetch(url, { headers: { Accept: "*/*" } });
	if (!response.ok) {
		throw new Error(`${response.status} ${response.statusText}`);
	}
	return await response.text();
}

export function extractLocsFromXml(xml: string): string[] {
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
			([name, value]) => {
				const attributePattern = new RegExp(
					`${name}\\s*=\\s*["']${value}["']`,
					"i",
				);
				return attributePattern.test(tag);
			},
		);

		if (!hasRequiredAttributes) {
			continue;
		}

		const targetMatch = tag.match(
			new RegExp(`${targetAttribute}\\s*=\\s*["']([^"']+)["']`, "i"),
		);
		if (targetMatch?.[1]) {
			return targetMatch[1];
		}
	}

	return null;
}

function normalizeUrl(url: string): string {
	const parsed = new URL(url);
	let pathname = parsed.pathname;
	if (pathname.length > 1 && pathname.endsWith("/")) {
		pathname = pathname.slice(0, -1);
	}
	return `${parsed.protocol}//${parsed.host}${pathname}`;
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

async function getSitemapFetchResult(base: string): Promise<SitemapFetchResult> {
	const candidates = [
		new URL("/sitemap-index.xml", base).href,
		new URL("/sitemap.xml", base).href,
	];

	for (const sitemapUrl of candidates) {
		try {
			const xml = await fetchText(sitemapUrl);
			const locs = extractLocsFromXml(xml);
			if (locs.length === 0) {
				continue;
			}

			const looksLikeIndex =
				xml.includes("<sitemapindex") ||
				locs.some((loc) => /sitemap.*\.xml/i.test(loc));
			if (!looksLikeIndex) {
				return {
					indexUrl: sitemapUrl,
					sitemapLocs: [sitemapUrl],
					pageUrls: Array.from(new Set(locs)),
				};
			}

			const sitemapLocs = Array.from(new Set(locs));
			const pageUrls: string[] = [];

			for (const loc of sitemapLocs) {
				try {
					const childXml = await fetchText(loc);
					pageUrls.push(...extractLocsFromXml(childXml));
				} catch (error) {
					console.warn(`Failed to read child sitemap ${loc}:`, error);
				}
			}

			return {
				indexUrl: sitemapUrl,
				sitemapLocs,
				pageUrls: Array.from(new Set(pageUrls)),
			};
		} catch {
			// Try the next candidate.
		}
	}

	throw new Error("Could not fetch sitemap index or sitemap.xml");
}

async function checkUrl(
	url: string,
	apexHost: string,
	expectation?: UrlExpectation,
): Promise<UrlCheckResult> {
	const response = await fetch(url, { headers: { Accept: "text/html" } });
	const ok = response.status === 200;
	const contentType = response.headers.get("content-type") || "";

	let canonical: string | null = null;
	let canonicalOk = false;
	let hostOk = false;
	let robots: string | null = null;
	let robotsOk = expectation?.expectedRobots == null;

	if (ok && contentType.includes("text/html")) {
		const html = await response.text();
		canonical = extractTagAttribute(
			html,
			"link",
			{ rel: "canonical" },
			"href",
		);
		robots = extractTagAttribute(
			html,
			"meta",
			{ name: "robots" },
			"content",
		);

		const expectedCanonical = expectation?.expectedCanonical ?? url;
		if (canonical) {
			canonicalOk =
				normalizeUrl(canonical) === normalizeUrl(expectedCanonical);
			hostOk =
				new URL(canonical).hostname.replace(/^www\./, "") === apexHost;
		}

		if (expectation?.expectedRobots) {
			robotsOk =
				normalizeRobots(robots) === normalizeRobots(expectation.expectedRobots);
		}
	}

	return {
		url,
		ok,
		canonical,
		canonicalOk,
		hostOk,
		robots,
		robotsOk,
		status: response.status,
	};
}

export async function run() {
	const { base, limit, concurrency } = parseArgs();
	const apexHost = new URL(base).hostname.replace(/^www\./, "");

	console.log(
		`Checking sitemap for ${base} (limit=${limit}, concurrency=${concurrency})`,
	);

	const { indexUrl, sitemapLocs, pageUrls } = await getSitemapFetchResult(base);
	const limitedPageUrls = pageUrls.slice(0, limit);
	console.log(`Fetched sitemap index: ${indexUrl}`);
	console.log(`Found ${sitemapLocs.length} child sitemaps and ${pageUrls.length} URLs`);

	const sitemapPaths = new Set(sitemapLocs.map((loc) => new URL(loc).pathname));
	const missingSitemaps = REQUIRED_SITEMAP_PATHS.filter(
		(path) => !sitemapPaths.has(path),
	);
	const disallowedSitemapUrls = pageUrls.filter((url) => {
		const pathname = new URL(url).pathname;
		return DISALLOWED_SITEMAP_PATH_PREFIXES.some((prefix) =>
			pathname.startsWith(prefix),
		);
	});

	const pageResults: UrlCheckResult[] = [];
	let pageErrorCount = 0;
	let pageIndex = 0;

	async function worker() {
		while (pageIndex < limitedPageUrls.length) {
			const currentIndex = pageIndex++;
			const url = limitedPageUrls[currentIndex];
			if (!url) {
				continue;
			}

			try {
				const result = await checkUrl(url, apexHost);
				pageResults.push(result);
				const indicator =
					result.ok && result.canonicalOk && result.hostOk ? "OK" : "WARN";
				console.log(`${indicator} ${url} [${result.status}]`);
			} catch (error) {
				pageErrorCount += 1;
				console.log(`FAIL ${url} -> ${error}`);
			}
		}
	}

	await Promise.all(Array.from({ length: concurrency }, worker));

	const supplementalChecks = buildSupplementalUrlChecks(base);
	const supplementalResults = await Promise.all(
		supplementalChecks.map((check) =>
			checkUrl(check.url, apexHost, check).then((result) => ({
				...result,
				expectedRobots: check.expectedRobots ?? null,
			})),
		),
	);

	const pageFailures = pageResults.filter(
		(result) => !result.ok || !result.canonicalOk || !result.hostOk,
	);
	const supplementalFailures = supplementalResults.filter(
		(result) =>
			!result.ok || !result.canonicalOk || !result.hostOk || !result.robotsOk,
	);

	console.log("\nSummary:");
	console.log(`  Total sitemap URLs checked: ${pageResults.length}`);
	console.log(`  Required sitemap files missing: ${missingSitemaps.length}`);
	console.log(`  Disallowed URLs in sitemap set: ${disallowedSitemapUrls.length}`);
	console.log(`  Canonical/page failures: ${pageFailures.length}`);
	console.log(`  Page fetch errors: ${pageErrorCount}`);
	console.log(`  Supplemental URL failures: ${supplementalFailures.length}`);

	if (missingSitemaps.length > 0) {
		console.log("\nMissing required sitemap files:");
		for (const path of missingSitemaps) {
			console.log(`  - ${path}`);
		}
	}

	if (disallowedSitemapUrls.length > 0) {
		console.log("\nDisallowed URLs present in sitemap set:");
		for (const url of disallowedSitemapUrls) {
			console.log(`  - ${url}`);
		}
	}

	if (supplementalResults.length > 0) {
		console.log("\nSupplemental checks:");
		for (const result of supplementalResults) {
			const indicator =
				result.ok && result.canonicalOk && result.hostOk && result.robotsOk
					? "OK"
					: "WARN";
			console.log(
				`  ${indicator} ${result.url} [${result.status}] canonical=${result.canonical ?? "missing"} robots=${result.robots ?? "missing"}`,
			);
		}
	}

	if (
		missingSitemaps.length > 0 ||
		disallowedSitemapUrls.length > 0 ||
		pageFailures.length > 0 ||
		pageErrorCount > 0 ||
		supplementalFailures.length > 0
	) {
		process.exit(2);
	}
}

const isMainModule = process.argv[1]?.endsWith("check-sitemap.ts");

if (isMainModule) {
	run().catch((error) => {
		console.error("Failed:", error);
		process.exit(1);
	});
}
