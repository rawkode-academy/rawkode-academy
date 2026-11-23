#!/usr/bin/env bun
/*
  Crawl internal links to find orphans and pages deeper than a given click depth.
  Usage: bun scripts/orphan-check.ts --base https://rawkode.academy --maxDepth 3 --limit 1000
*/

type Args = {
	base: string;
	maxDepth: number;
	limit: number;
	crawlDepth: number;
};

function parseArgs(): Args {
	const argv = process.argv.slice(2);
	const get = (k: string, d?: string) => {
		const i = argv.indexOf(k);
		return i >= 0 ? argv[i + 1] : d;
	};
	return {
		base: get("--base", "https://rawkode.academy")!,
		maxDepth: parseInt(get("--maxDepth", "3")!, 10),
		limit: parseInt(get("--limit", "1000")!, 10),
		crawlDepth: parseInt(get("--crawlDepth", "7")!, 10),
	};
}

function isInternal(baseHost: string, href: string) {
	try {
		const u = new URL(href, `https://${baseHost}`);
		return u.host === baseHost && u.protocol.startsWith("http");
	} catch {
		return false;
	}
}

export function normalizeUrl(url: string): string {
	const u = new URL(url);
	let p = u.pathname;
	if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
	return `${u.protocol}//${u.host}${p}`;
}

export function extractLocsFromXml(xml: string): string[] {
	const locs: string[] = [];
	const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
	for (const match of xml.matchAll(re)) {
		const raw = match[1]?.trim();
		if (raw) {
			locs.push(raw.replace(/&amp;/g, "&"));
		}
	}
	return locs;
}

export async function fetchSitemapUrls(
	base: string,
	fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
	const candidates = [
		new URL("/sitemap-index.xml", base).href,
		new URL("/sitemap.xml", base).href,
	];

	for (const candidate of candidates) {
		try {
			const res = await fetchImpl(candidate, {
				headers: { Accept: "application/xml,text/xml,*/*" },
			});
			if (!res.ok) continue;
			const xml = await res.text();
			const locs = extractLocsFromXml(xml);
			if (locs.length === 0) continue;

			const isIndex =
				xml.includes("<sitemapindex") ||
				locs.some((loc) => /sitemap.*\.xml/i.test(loc));
			if (!isIndex) {
				return Array.from(new Set(locs.map((loc) => normalizeUrl(loc))));
			}

			const pageUrls = new Set<string>();
			for (const childLoc of Array.from(new Set(locs))) {
				try {
					const childRes = await fetchImpl(childLoc, {
						headers: { Accept: "application/xml,text/xml,*/*" },
					});
					if (!childRes.ok) continue;
					const childXml = await childRes.text();
					for (const pageLoc of extractLocsFromXml(childXml)) {
						pageUrls.add(normalizeUrl(pageLoc));
					}
				} catch {
					// Continue processing remaining child sitemaps.
				}
			}
			return Array.from(pageUrls).sort();
		} catch {
			// Try next sitemap candidate.
		}
	}

	return [];
}

export function findSitemapOrphans(
	sitemapUrls: Iterable<string>,
	crawledUrls: ReadonlySet<string>,
): string[] {
	const normalizedCrawled = new Set<string>();
	for (const url of crawledUrls) {
		try {
			normalizedCrawled.add(normalizeUrl(url));
		} catch {
			normalizedCrawled.add(url);
		}
	}

	const orphans = new Set<string>();
	for (const url of sitemapUrls) {
		const normalized = normalizeUrl(url);
		if (!normalizedCrawled.has(normalized)) {
			orphans.add(normalized);
		}
	}

	return Array.from(orphans).sort();
}

async function fetchHtml(url: string) {
	const res = await fetch(url, { headers: { Accept: "text/html" } });
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
	return await res.text();
}

function extractLinks(html: string, baseUrl: string) {
	const re = /<a\s+[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
	const out: string[] = [];
	let m: RegExpExecArray | null;
	const base = new URL(baseUrl);
	while ((m = re.exec(html))) {
		try {
			const href = m[1];
			if (!href) continue; // noUncheckedIndexedAccess safety
			const abs = new URL(href, base).href;
			out.push(abs);
		} catch {}
	}
	return out;
}

export async function run() {
	const { base, maxDepth, limit, crawlDepth } = parseArgs();
	const baseHost = new URL(base).host.replace(/^www\./, "");
	const start = normalizeUrl(base);

	const sitemapUrls = await fetchSitemapUrls(base);

	const queue: { url: string; depth: number }[] = [{ url: start, depth: 0 }];
	const seen = new Set<string>();
	const depthMap = new Map<string, number>();
	const errors: string[] = [];

	while (queue.length && seen.size < limit) {
		const { url, depth } = queue.shift()!;
		if (seen.has(url) || depth > crawlDepth) continue;
		seen.add(url);
		depthMap.set(url, depth);
		try {
			const html = await fetchHtml(url);
			const links = extractLinks(html, url);
			for (const l of links) {
				if (!isInternal(baseHost, l)) continue;
				const n = normalizeUrl(l);
				if (!seen.has(n)) queue.push({ url: n, depth: depth + 1 });
			}
		} catch (e) {
			errors.push(`${url}: ${e}`);
		}
	}

	const visited = Array.from(seen);
	const deepPages = visited.filter((u) => (depthMap.get(u) ?? 0) > maxDepth);
	const orphans = findSitemapOrphans(sitemapUrls, seen);

	console.log(
		`Crawled ${visited.length} pages (limit ${limit}, maxDepth ${maxDepth}); sitemap URLs: ${sitemapUrls.length}.`,
	);
	if (errors.length) {
		console.log(`Errors (${errors.length}):`);
		for (const e of errors) console.log(`  - ${e}`);
	}
	if (orphans.length) {
		console.log(`\nSitemap orphans (${orphans.length}):`);
		for (const u of orphans) console.log(`  - ${u}`);
	} else {
		console.log("\nNo sitemap orphans detected at this crawl depth.");
	}

	if (deepPages.length) {
		console.log(
			`\nPages deeper than ${maxDepth} clicks from home (${deepPages.length}):`,
		);
		for (const u of deepPages)
			console.log(`  - ${u} (depth ${depthMap.get(u)})`);
	}
}

const isMainModule = process.argv[1]?.endsWith("orphan-check.ts");

if (isMainModule) {
	run().catch((e) => {
		console.error(e);
		process.exit(1);
	});
}
