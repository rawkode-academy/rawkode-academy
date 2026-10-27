#!/usr/bin/env bun
/*
  Core Web Vitals guardrail check using PageSpeed Insights.

  Uses Chrome UX Report field data (75th percentile LCP, INP, CLS) when
  PageSpeed has it for the URL, then for the origin. Without field data it
  falls back to the Lighthouse lab run, which cannot measure INP: the lab
  result reports Total Blocking Time as TBT, never as INP.

  Usage:
    bun scripts/check-cwv.ts --base https://rawkode.academy
    bun scripts/check-cwv.ts --base https://rawkode.academy --pages /,/watch,/read
    bun scripts/check-cwv.ts --base https://rawkode.academy --strategies mobile,desktop
*/

type Strategy = "mobile" | "desktop";

type Args = {
	base: string;
	pages: string[];
	strategies: Strategy[];
	apiKey: string | undefined;
};

/** Where the numbers came from: CrUX field data, or a Lighthouse lab run. */
export type CwvSource = "field:url" | "field:origin" | "lab";

export type CwvMeasurement = {
	source: CwvSource;
	lcpMs: number | null;
	cls: number | null;
	/** INP for field data; TBT for a lab run (Lighthouse cannot measure INP). */
	responsivenessMetric: "INP" | "TBT";
	responsivenessMs: number | null;
	performanceScore: number | null;
	passed: boolean;
	failures: string[];
};

type CwvResult = CwvMeasurement & {
	url: string;
	strategy: Strategy;
};

type CruxMetric = { percentile?: number };

type LoadingExperience = {
	origin_fallback?: boolean;
	metrics?: Record<string, CruxMetric>;
};

export type PageSpeedResponse = {
	loadingExperience?: LoadingExperience;
	originLoadingExperience?: LoadingExperience;
	lighthouseResult?: {
		audits?: Record<string, { numericValue?: number }>;
		categories?: {
			performance?: {
				score?: number;
			};
		};
	};
};

const DEFAULT_PAGES = [
	"/",
	"/watch",
	"/read",
	"/technology",
	"/shows",
	"/learning-paths",
	"/courses",
	"/about",
	"/organizations/partnerships",
	"/resources/kubernetes/1.35-cheatsheet",
];

const DEFAULT_STRATEGIES: Strategy[] = ["mobile", "desktop"];

function parseArgs(): Args {
	const argv = process.argv.slice(2);
	const get = (flag: string) => {
		const index = argv.indexOf(flag);
		return index !== -1 ? argv[index + 1] : undefined;
	};

	const base = get("--base") || "https://rawkode.academy";
	const pagesArg = get("--pages");
	const strategiesArg = get("--strategies");
	const apiKey = get("--api-key") || process.env.PAGESPEED_API_KEY;

	const pages = pagesArg
		? pagesArg
				.split(",")
				.map((value) => value.trim())
				.filter(Boolean)
		: DEFAULT_PAGES;

	const strategies = (
		strategiesArg
			? strategiesArg
					.split(",")
					.map((value) => value.trim().toLowerCase())
					.filter(
						(value): value is Strategy =>
							value === "mobile" || value === "desktop",
					)
			: DEFAULT_STRATEGIES
	) as Strategy[];

	return { base, pages, strategies, apiKey };
}

function toUrl(base: string, pathOrUrl: string): string {
	if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
		return pathOrUrl;
	}
	const pathname = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
	return new URL(pathname, base).href;
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

	const retryDate = new Date(retryAfter);
	const retryTime = retryDate.getTime();
	if (Number.isNaN(retryTime)) return null;
	return Math.max(retryTime - Date.now(), 0);
}

async function runPageSpeed(
	url: string,
	strategy: Strategy,
	apiKey?: string,
): Promise<CwvResult> {
	const endpoint = new URL(
		"https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
	);
	endpoint.searchParams.set("url", url);
	endpoint.searchParams.set("strategy", strategy);
	endpoint.searchParams.set("category", "performance");
	if (apiKey) endpoint.searchParams.set("key", apiKey);

	const maxRetries = 3;
	const baseDelayMs = 1000;
	let response: Response | null = null;

	for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
		response = await fetch(endpoint, {
			headers: { Accept: "application/json" },
		});

		if (response.ok) {
			break;
		}

		const status = response.status;
		const retryable = status === 429 || status >= 500;
		if (!retryable || attempt === maxRetries) {
			throw new Error(
				`PageSpeed API failed (${response.status} ${response.statusText})`,
			);
		}

		const retryAfterMs = parseRetryAfterMs(response.headers.get("Retry-After"));
		const backoffMs = Math.min(baseDelayMs * 2 ** (attempt - 1), 10000);
		await sleep(retryAfterMs ?? backoffMs);
	}

	if (!response || !response.ok) {
		throw new Error("PageSpeed API failed after retries");
	}

	const data = (await response.json()) as PageSpeedResponse;
	return { url, strategy, ...evaluatePageSpeed(data) };
}

function cruxPercentile(
	experience: LoadingExperience,
	metric: string,
): number | null {
	const value = experience.metrics?.[metric]?.percentile;
	return typeof value === "number" ? value : null;
}

function fieldExperience(
	data: PageSpeedResponse,
): { source: CwvSource; experience: LoadingExperience } | null {
	const page = data.loadingExperience;
	if (page?.metrics && Object.keys(page.metrics).length > 0) {
		return {
			source: page.origin_fallback ? "field:origin" : "field:url",
			experience: page,
		};
	}
	const origin = data.originLoadingExperience;
	if (origin?.metrics && Object.keys(origin.metrics).length > 0) {
		return { source: "field:origin", experience: origin };
	}
	return null;
}

/**
 * Good thresholds: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1 at the 75th
 * percentile (web.dev/articles/vitals). The lab fallback checks TBT against
 * Lighthouse's own 200ms "good" mark and labels it TBT.
 */
export function evaluatePageSpeed(data: PageSpeedResponse): CwvMeasurement {
	const scoreRaw = data?.lighthouseResult?.categories?.performance?.score;
	const performanceScore = typeof scoreRaw === "number" ? scoreRaw * 100 : null;

	const field = fieldExperience(data);
	let lcpMs: number | null;
	let cls: number | null;
	let responsivenessMs: number | null;
	let responsivenessMetric: "INP" | "TBT";
	if (field) {
		lcpMs = cruxPercentile(field.experience, "LARGEST_CONTENTFUL_PAINT_MS");
		const clsTimes100 = cruxPercentile(
			field.experience,
			"CUMULATIVE_LAYOUT_SHIFT_SCORE",
		);
		cls = clsTimes100 === null ? null : clsTimes100 / 100;
		responsivenessMs = cruxPercentile(
			field.experience,
			"INTERACTION_TO_NEXT_PAINT",
		);
		responsivenessMetric = "INP";
	} else {
		const audits = (data?.lighthouseResult?.audits ?? {}) as Record<
			string,
			{ numericValue?: number }
		>;
		lcpMs = getAuditNumericValue(audits, "largest-contentful-paint");
		cls = getAuditNumericValue(audits, "cumulative-layout-shift");
		responsivenessMs = getAuditNumericValue(audits, "total-blocking-time");
		responsivenessMetric = "TBT";
	}

	const failures: string[] = [];
	if (lcpMs === null || lcpMs > 2500) {
		failures.push(`LCP ${lcpMs === null ? "missing" : `${lcpMs}ms`} > 2500ms`);
	}
	if (cls === null || cls > 0.1) {
		failures.push(`CLS ${cls ?? "missing"} > 0.1`);
	}
	if (responsivenessMs === null || responsivenessMs > 200) {
		failures.push(
			`${responsivenessMetric} ${responsivenessMs === null ? "missing" : `${responsivenessMs}ms`} > 200ms`,
		);
	}

	return {
		source: field?.source ?? "lab",
		lcpMs,
		cls,
		responsivenessMetric,
		responsivenessMs,
		performanceScore,
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

async function run() {
	const { base, pages, strategies, apiKey } = parseArgs();
	const urls = pages.map((page) => toUrl(base, page));

	if (!apiKey) {
		console.warn(
			"Warning: PAGESPEED_API_KEY is not set. Requests may be rate-limited.",
		);
	}

	console.log(
		`Running CWV checks for ${urls.length} pages across ${strategies.length} strategies`,
	);

	const results: CwvResult[] = [];

	for (const strategy of strategies) {
		for (const url of urls) {
			try {
				const result = await runPageSpeed(url, strategy, apiKey);
				results.push(result);

				const marker = result.passed ? "PASS" : "FAIL";
				console.log(
					`${marker} [${strategy}] [${result.source}] ${url} | LCP ${fmtMs(result.lcpMs)} | CLS ${fmtCls(result.cls)} | ${result.responsivenessMetric} ${fmtMs(result.responsivenessMs)} | Lab score ${fmtScore(result.performanceScore)}`,
				);
				if (!result.passed) {
					for (const failure of result.failures) {
						console.log(`  - ${failure}`);
					}
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.log(`FAIL [${strategy}] ${url} | ${message}`);
				results.push({
					url,
					strategy,
					source: "lab",
					lcpMs: null,
					cls: null,
					responsivenessMetric: "TBT",
					responsivenessMs: null,
					performanceScore: null,
					passed: false,
					failures: [message],
				});
			}
		}
	}

	const failures = results.filter((result) => !result.passed);
	console.log("");
	console.log("Summary:");
	console.log(`  Total checks: ${results.length}`);
	console.log(`  Passed: ${results.length - failures.length}`);
	console.log(`  Failed: ${failures.length}`);

	if (failures.length > 0) {
		process.exit(2);
	}
}

const isMainModule = process.argv[1]?.endsWith("check-cwv.ts");

if (isMainModule) {
	run().catch((error) => {
		console.error("CWV check failed:", error);
		process.exit(1);
	});
}
