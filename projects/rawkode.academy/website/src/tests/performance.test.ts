import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(TEST_DIR, "../..");

const readProjectFile = (relativePath: string): string =>
	readFileSync(resolve(PROJECT_ROOT, relativePath), "utf-8");

describe("Core Web Vitals Guardrails", () => {
	it("loads PostHog only after consent and idle time", () => {
		const source = readProjectFile("src/components/posthog/index.astro");

		expect(source).toContain("window.enablePostHog");
		expect(source).toContain("consent_analytics");
		expect(source).toContain("requestIdleCallback");
		expect(source).toContain("shouldEnableTracking()");
		expect(source).not.toContain("type=\"text/partytown\"");
	});

	it("loads Grafana SDKs lazily via dynamic imports", () => {
		const source = readProjectFile("src/components/grafana/index.astro");

		expect(source).toContain("window.enableGrafanaFaro");
		expect(source).toContain("requestIdleCallback");
		expect(source).toContain('import("@grafana/faro-web-sdk")');
		expect(source).toContain('import("@grafana/faro-web-tracing")');
		expect(source).not.toMatch(
			/^\s*import\s+\{[^}]+\}\s+from\s+["']@grafana\/faro-web-sdk["'];?/m,
		);
	});

	it("preloads only the primary body font", () => {
		const source = readProjectFile("src/components/html/head.astro");
		const preloadedFonts = source.match(/<Font[^>]*preload[^>]*>/g) ?? [];

		expect(preloadedFonts).toHaveLength(1);
		expect(source).toContain('<Font cssVariable="--font-poppins" preload />');
		expect(source).not.toContain("--font-monaspace-neon\" preload");
	});

	it("avoids eager preconnects to non-critical analytics domains", () => {
		const source = readProjectFile("src/components/html/head.astro");

		expect(source).not.toContain("https://eu.i.posthog.com");
		expect(source).not.toContain(
			"https://faro-collector-prod-gb-south-1.grafana.net",
		);
	});

	it("keeps Partytown disabled for PostHog crash mitigation", () => {
		const source = readProjectFile("astro.config.mts");

		expect(source).not.toContain("partytown(");
		expect(source).not.toContain("@astrojs/partytown");
	});

	it("uses @reference instead of re-importing global CSS in head", () => {
		const source = readProjectFile("src/components/html/head.astro");

		expect(source).toContain('@reference "@/styles/global.css";');
		expect(source).not.toContain('@import "@/styles/global.css";');
	});
});
