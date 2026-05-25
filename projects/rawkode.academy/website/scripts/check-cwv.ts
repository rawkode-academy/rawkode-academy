#!/usr/bin/env -S deno run --allow-net --allow-env=PAGESPEED_API_KEY
/*
  Core Web Vitals guardrail check using PageSpeed Insights.
  Usage:
    deno run --allow-net --allow-env=PAGESPEED_API_KEY scripts/check-cwv.ts --base https://rawkode.academy
    deno run --allow-net --allow-env=PAGESPEED_API_KEY scripts/check-cwv.ts --base https://rawkode.academy --pages /,/watch,/read
    deno run --allow-net --allow-env=PAGESPEED_API_KEY scripts/check-cwv.ts --base https://rawkode.academy --strategies mobile,desktop
*/

import process from "node:process";
import { flagValue } from "./lib/args.ts";

type Strategy = "mobile" | "desktop";

type Args = {
	base: string;
	pages: string[];
	strategies: Strategy[];
	apiKey: string | undefined;
};

type CwvResult = {
	url: string;
	strategy: Strategy;
	lcpMs: number | null;
	cls: number | null;
	inpOrTbtMs: number | null;
	inpSource: "INP" | "TBT";
	performanceScore: number | null;
	passed: boolean;
	failures: string[];
};

type PageSpeedResponse = {
	lighthouseResult?: {
		audits?: Record<string, { numericValue?: number }>;
		categories?: {
			performance?: {
				score?: number;
			};
		};
	};
};

type PageSpeedMetrics = Omit<
	CwvResult,
	"url" | "strategy" | "passed" | "failures"
>;

const DEFAULT_PAGES = [
	"/",
	"/watch",
	"/read",
	"/technology",
	"/shows",
	"/learning-paths",
	"/courses",
	"/about",
	"/organizations",
	"/resources/kubernetes/1.35-cheatsheet",
];

const DEFAULT_STRATEGIES: Strategy[] = ["mobile", "desktop"];
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function csvValues(value: string | undefined, fallback: string[]): string[] {
	if (!value) return fallback;
	const parsed = value.split(",").map((item) => item.trim()).filter(Boolean);
	return parsed.length > 0 ? parsed : fallback;
}

function strategyValues(value: string | undefined): Strategy[] {
	return csvValues(value, DEFAULT_STRATEGIES).filter(
		(item): item is Strategy => item === "mobile" || item === "desktop",
	);
}

function parseArgs(): Args {
	const argv = process.argv.slice(2);
	return {
		base: flagValue(argv, "--base", "https://rawkode.academy")!,
		pages: csvValues(flagValue(argv, "--pages"), DEFAULT_PAGES),
		strategies: strategyValues(flagValue(argv, "--strategies")),
		apiKey: flagValue(argv, "--api-key") || process.env.PAGESPEED_API_KEY,
	};
}

function toUrl(base: string, pathOrUrl: string): string {
	if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
		return pathOrUrl;
	}
	const pathname = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
	return new URL(pathname, base).href;
}

function buildPageSpeedUrl(
	url: string,
	strategy: Strategy,
	apiKey?: string,
): URL {
	const endpoint = new URL(
		"https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
	);
	endpoint.searchParams.set("url", url);
	endpoint.searchParams.set("strategy", strategy);
	endpoint.searchParams.set("category", "performance");
	if (apiKey) endpoint.searchParams.set("key", apiKey);
	return endpoint;
}

function getAuditNumericValue(
	audits: Record<string, { numericValue?: number }>,
	id: string,
): number | null {
	const value = audits[id]?.numericValue;
	return typeof value === "number" ? value : null;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(retryAfter: string | null): number | null {
	if (!retryAfter) return null;
	const seconds = Number.parseInt(retryAfter, 10);
	if (!Number.isNaN(seconds)) {
		return Math.max(seconds * 1000, 0);
	}

	const retryTime = new Date(retryAfter).getTime();
	return Number.isNaN(retryTime) ? null : Math.max(retryTime - Date.now(), 0);
}

function isRetryable(response: Response): boolean {
	return response.status === 429 || response.status >= 500;
}

function retryDelayMs(response: Response, attempt: number): number {
	const retryAfterMs = parseRetryAfterMs(response.headers.get("Retry-After"));
	const backoffMs = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), 10000);
	return retryAfterMs ?? backoffMs;
}

async function fetchPageSpeed(endpoint: URL): Promise<PageSpeedResponse> {
	for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
		const response = await fetch(endpoint, {
			headers: { Accept: "application/json" },
		});
		if (response.ok) return await response.json() as PageSpeedResponse;
		if (!isRetryable(response) || attempt === MAX_RETRIES) {
			throw new Error(
				`PageSpeed API failed (${response.status} ${response.statusText})`,
			);
		}
		await sleep(retryDelayMs(response, attempt));
	}

	throw new Error("PageSpeed API failed after retries");
}

function pageSpeedMetrics(data: PageSpeedResponse): PageSpeedMetrics {
	const audits = data.lighthouseResult?.audits ?? {};
	const performanceScoreRaw = data.lighthouseResult?.categories?.performance
		?.score;
	const inpMs = getAuditNumericValue(audits, "interaction-to-next-paint") ??
		getAuditNumericValue(audits, "experimental-interaction-to-next-paint");
	const tbtMs = getAuditNumericValue(audits, "total-blocking-time");

	return {
		lcpMs: getAuditNumericValue(audits, "largest-contentful-paint"),
		cls: getAuditNumericValue(audits, "cumulative-layout-shift"),
		inpOrTbtMs: inpMs ?? tbtMs,
		inpSource: inpMs !== null ? "INP" : "TBT",
		performanceScore: typeof performanceScoreRaw === "number"
			? performanceScoreRaw * 100
			: null,
	};
}

function thresholdFailures(metrics: PageSpeedMetrics): string[] {
	const failures: string[] = [];
	const lcpDisplay = metrics.lcpMs === null ? "missing" : `${metrics.lcpMs}ms`;
	const inpOrTbtDisplay = metrics.inpOrTbtMs === null
		? "missing"
		: `${metrics.inpOrTbtMs}ms`;

	if (metrics.lcpMs === null || metrics.lcpMs > 2500) {
		failures.push(`LCP ${lcpDisplay} > 2500ms`);
	}
	if (metrics.cls === null || metrics.cls > 0.1) {
		failures.push(`CLS ${metrics.cls ?? "missing"} > 0.1`);
	}
	if (metrics.inpOrTbtMs === null || metrics.inpOrTbtMs > 200) {
		failures.push(`${metrics.inpSource} ${inpOrTbtDisplay} > 200ms`);
	}

	return failures;
}

async function runPageSpeed(
	url: string,
	strategy: Strategy,
	apiKey?: string,
): Promise<CwvResult> {
	const metrics = pageSpeedMetrics(
		await fetchPageSpeed(buildPageSpeedUrl(url, strategy, apiKey)),
	);
	const failures = thresholdFailures(metrics);
	return {
		url,
		strategy,
		...metrics,
		passed: failures.length === 0,
		failures,
	};
}

function fmtMs(value: number | null): string {
	return value === null ? "n/a" : `${Math.round(value)}ms`;
}

function fmtCls(value: number | null): string {
	return value === null ? "n/a" : value.toFixed(3);
}

function fmtScore(value: number | null): string {
	return value === null ? "n/a" : `${Math.round(value)}`;
}

function printResult(result: CwvResult) {
	const marker = result.passed ? "PASS" : "FAIL";
	console.log(
		`${marker} [${result.strategy}] ${result.url} | LCP ${
			fmtMs(result.lcpMs)
		} | CLS ${fmtCls(result.cls)} | ${result.inpSource} ${
			fmtMs(result.inpOrTbtMs)
		} | Score ${fmtScore(result.performanceScore)}`,
	);

	for (const failure of result.failures) {
		console.log(`  - ${failure}`);
	}
}

function failedResult(
	url: string,
	strategy: Strategy,
	error: unknown,
): CwvResult {
	const message = error instanceof Error ? error.message : String(error);
	console.log(`FAIL [${strategy}] ${url} | ${message}`);
	return {
		url,
		strategy,
		lcpMs: null,
		cls: null,
		inpOrTbtMs: null,
		inpSource: "INP",
		performanceScore: null,
		passed: false,
		failures: [message],
	};
}

async function runChecks(args: Args): Promise<CwvResult[]> {
	const urls = args.pages.map((page) => toUrl(args.base, page));
	const results: CwvResult[] = [];

	console.log(
		`Running CWV checks for ${urls.length} pages across ${args.strategies.length} strategies`,
	);

	for (const strategy of args.strategies) {
		for (const url of urls) {
			try {
				const result = await runPageSpeed(url, strategy, args.apiKey);
				printResult(result);
				results.push(result);
			} catch (error) {
				results.push(failedResult(url, strategy, error));
			}
		}
	}

	return results;
}

function printSummary(results: CwvResult[]): number {
	const failures = results.filter((result) => !result.passed);
	console.log("");
	console.log("Summary:");
	console.log(`  Total checks: ${results.length}`);
	console.log(`  Passed: ${results.length - failures.length}`);
	console.log(`  Failed: ${failures.length}`);
	return failures.length;
}

async function run() {
	const args = parseArgs();
	if (!args.apiKey) {
		console.warn(
			"Warning: PAGESPEED_API_KEY is not set. Requests may be rate-limited.",
		);
	}

	if (printSummary(await runChecks(args)) > 0) {
		process.exit(2);
	}
}

run().catch((error) => {
	console.error("CWV check failed:", error);
	process.exit(1);
});
