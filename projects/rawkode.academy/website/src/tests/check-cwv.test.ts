import { describe, expect, it } from "vitest";
import { evaluatePageSpeed } from "../../scripts/check-cwv.ts";

const crux = (lcp: number, inp: number, clsTimes100: number) => ({
	LARGEST_CONTENTFUL_PAINT_MS: { percentile: lcp },
	INTERACTION_TO_NEXT_PAINT: { percentile: inp },
	CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: clsTimes100 },
});

const lab = (lcp: number, tbt: number, cls: number) => ({
	lighthouseResult: {
		categories: { performance: { score: 0.9 } },
		audits: {
			"largest-contentful-paint": { numericValue: lcp },
			"total-blocking-time": { numericValue: tbt },
			"cumulative-layout-shift": { numericValue: cls },
		},
	},
});

describe("Core Web Vitals evaluation", () => {
	it("uses URL field data at the 75th percentile and reports INP", () => {
		const result = evaluatePageSpeed({
			...lab(9000, 900, 0.5),
			loadingExperience: { metrics: crux(2100, 180, 5) },
		});
		expect(result).toMatchObject({
			source: "field:url",
			lcpMs: 2100,
			cls: 0.05,
			responsivenessMetric: "INP",
			responsivenessMs: 180,
			passed: true,
		});
	});

	it("labels origin-level field data as origin", () => {
		const fallback = evaluatePageSpeed({
			loadingExperience: { origin_fallback: true, metrics: crux(3000, 150, 2) },
		});
		expect(fallback.source).toBe("field:origin");
		expect(fallback.failures).toEqual(["LCP 3000ms > 2500ms"]);
		const originOnly = evaluatePageSpeed({
			originLoadingExperience: { metrics: crux(2000, 250, 2) },
		});
		expect(originOnly.source).toBe("field:origin");
		expect(originOnly.failures).toEqual(["INP 250ms > 200ms"]);
	});

	it("never reports lab TBT as INP", () => {
		const result = evaluatePageSpeed(lab(2000, 350, 0.02));
		expect(result).toMatchObject({
			source: "lab",
			responsivenessMetric: "TBT",
			responsivenessMs: 350,
			performanceScore: 90,
		});
		expect(result.failures).toEqual(["TBT 350ms > 200ms"]);
	});
});
