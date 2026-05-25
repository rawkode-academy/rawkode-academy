#!/usr/bin/env -S deno run --allow-net
/*
  Crawl internal links to find orphans and pages deeper than a given click depth.
  Usage: deno run --allow-net scripts/orphan-check.ts --base https://rawkode.academy --maxDepth 3 --limit 1000
*/
import process from "node:process";
import { flagValue, integerFlag } from "./lib/args.ts";
import { normalizeUrl } from "./lib/url.ts";

type Args = {
	base: string;
	maxDepth: number;
	limit: number;
	crawlDepth: number;
};

type QueueItem = {
	url: string;
	depth: number;
};

type CrawlResult = {
	visited: string[];
	deepPages: string[];
	orphans: string[];
	depthMap: Map<string, number>;
	errors: string[];
	limit: number;
	maxDepth: number;
};

type CrawlState = {
	queue: QueueItem[];
	seen: Set<string>;
	incoming: Map<string, number>;
	depthMap: Map<string, number>;
	errors: string[];
};

function parseArgs(): Args {
	const argv = process.argv.slice(2);
	return {
		base: flagValue(argv, "--base", "https://rawkode.academy")!,
		maxDepth: integerFlag(argv, "--maxDepth", 3),
		limit: integerFlag(argv, "--limit", 1000),
		crawlDepth: integerFlag(argv, "--crawlDepth", 7),
	};
}

function isInternal(baseHost: string, href: string) {
	try {
		const url = new URL(href, `https://${baseHost}`);
		return url.host === baseHost && url.protocol.startsWith("http");
	} catch {
		return false;
	}
}

async function fetchHtml(url: string) {
	const response = await fetch(url, { headers: { Accept: "text/html" } });
	if (!response.ok) {
		throw new Error(`${response.status} ${response.statusText}`);
	}
	return await response.text();
}

function extractLinks(html: string, baseUrl: string) {
	const links: string[] = [];
	const base = new URL(baseUrl);
	const re = /<a\s+[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
	let match: RegExpExecArray | null;

	while ((match = re.exec(html))) {
		try {
			const href = match[1];
			if (!href) continue;
			links.push(new URL(href, base).href);
		} catch {
			continue;
		}
	}

	return links;
}

function recordInternalLink(
	state: CrawlState,
	href: string,
	depth: number,
) {
	const normalized = normalizeUrl(href);
	state.incoming.set(normalized, (state.incoming.get(normalized) || 0) + 1);
	if (!state.seen.has(normalized)) {
		state.queue.push({ url: normalized, depth: depth + 1 });
	}
}

function shouldVisit(
	item: QueueItem,
	seen: Set<string>,
	crawlDepth: number,
): boolean {
	return !seen.has(item.url) && item.depth <= crawlDepth;
}

async function crawlPage(
	state: CrawlState,
	item: QueueItem,
	baseHost: string,
) {
	state.seen.add(item.url);
	state.depthMap.set(item.url, item.depth);
	try {
		const html = await fetchHtml(item.url);
		for (const href of extractLinks(html, item.url)) {
			if (isInternal(baseHost, href)) {
				recordInternalLink(state, href, item.depth);
			}
		}
	} catch (error) {
		state.errors.push(`${item.url}: ${error}`);
	}
}

function crawlResult(
	args: Args,
	start: string,
	state: CrawlState,
): CrawlResult {
	const visited = Array.from(state.seen);
	return {
		visited,
		deepPages: visited.filter((url) =>
			(state.depthMap.get(url) ?? 0) > args.maxDepth
		),
		orphans: visited.filter((url) =>
			(state.incoming.get(url) || 0) === 0 && url !== start
		),
		depthMap: state.depthMap,
		errors: state.errors,
		limit: args.limit,
		maxDepth: args.maxDepth,
	};
}

async function crawl(args: Args): Promise<CrawlResult> {
	const baseHost = new URL(args.base).host.replace(/^www\./, "");
	const start = normalizeUrl(args.base);
	const state: CrawlState = {
		queue: [{ url: start, depth: 0 }],
		seen: new Set<string>(),
		incoming: new Map<string, number>(),
		depthMap: new Map<string, number>(),
		errors: [],
	};

	while (state.queue.length && state.seen.size < args.limit) {
		const item = state.queue.shift()!;
		if (shouldVisit(item, state.seen, args.crawlDepth)) {
			await crawlPage(state, item, baseHost);
		}
	}

	return crawlResult(args, start, state);
}

function printList(title: string, items: string[]) {
	console.log(title);
	for (const item of items) {
		console.log(`  - ${item}`);
	}
}

function report(result: CrawlResult) {
	console.log(
		`Crawled ${result.visited.length} pages (limit ${result.limit}, maxDepth ${result.maxDepth}).`,
	);

	printOptionalList(`Errors (${result.errors.length}):`, result.errors);
	printOptionalList(
		`\nPotential orphans (${result.orphans.length}):`,
		result.orphans,
		"\nNo orphans detected at this crawl depth.",
	);
	printDeepPages(result);
}

function printOptionalList(
	title: string,
	items: string[],
	emptyMessage?: string,
) {
	if (items.length > 0) {
		printList(title, items);
		return;
	}
	if (emptyMessage) {
		console.log(emptyMessage);
	}
}

function printDeepPages(result: CrawlResult) {
	if (result.deepPages.length) {
		console.log(
			`\nPages deeper than ${result.maxDepth} clicks from home (${result.deepPages.length}):`,
		);
		for (const url of result.deepPages) {
			console.log(`  - ${url} (depth ${result.depthMap.get(url)})`);
		}
	}
}

async function run() {
	report(await crawl(parseArgs()));
}

run().catch((error) => {
	console.error(error);
	process.exit(1);
});
