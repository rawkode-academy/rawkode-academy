import { describe, expect, it } from "vitest";
import { createProjectFileReader } from "./read-project-file";

const readProjectFile = createProjectFileReader(import.meta.url, "../..");

describe("Core Web Vitals Guardrails", () => {
	it("loads PostHog lazily after idle time", () => {
		const source = readProjectFile("src/components/posthog/index.astro");

		expect(source).toContain("requestIdleCallback");
		expect(source).toContain("respect_dnt: true");
		expect(source).not.toContain("type=\"text/partytown\"");
	});

	it("loads Grafana SDKs lazily via dynamic imports", () => {
		const source = readProjectFile("src/components/grafana/index.astro");

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

		expect(preloadedFonts).toEqual([
			'<Font cssVariable="--font-inter-tight" preload />',
		]);
		expect(source).toContain('<Font cssVariable="--font-instrument-serif" />');
		expect(source).toContain('<Font cssVariable="--font-jetbrains-mono" />');
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

	it("keeps global CSS out of the production head", () => {
		const source = readProjectFile("src/components/html/head.astro");

		expect(source).toContain("import.meta.env.DEV");
		expect(source).toContain('href="/src/styles/global.css"');
		expect(source).not.toContain('@import "@/styles/global.css";');
	});

	it("keeps transcript payloads out of the idle watch-page island", () => {
		const source = readProjectFile("src/pages/watch/[...slug].astro");

		expect(source).toContain("<VideoContentTabs");
		expect(source).toContain("client:idle");
		expect(source).not.toContain("initialCues={");
		expect(source).not.toContain("initialParagraphs={");
		expect(source).not.toContain("transcript-preview-heading");
		expect(source).toContain("About this video");
		expect(source).not.toContain("descriptionHtml={renderedDescriptionHtml}");
	});

	it("keeps the watch tabs focused on supplemental content with resources selected by default", () => {
		const source = readProjectFile("src/components/video/video-content-tabs.vue");

		expect(source).not.toContain("descriptionHtml");
		expect(source).not.toContain('label: "Description"');
		expect(source).toContain('activeTab: "resources"');
	});
});
