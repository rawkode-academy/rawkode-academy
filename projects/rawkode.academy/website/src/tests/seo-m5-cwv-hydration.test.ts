import { readFileSync } from "node:fs";
import { parse, transform } from "@astrojs/compiler";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const slotBlock = (source: string, slot: string) => {
	const start = source.indexOf(`\t\t${slot}: {`);
	expect(start).toBeGreaterThan(-1);
	const end = source.indexOf("\n\t\t},", start);
	expect(end).toBeGreaterThan(start);
	return source.slice(start, end);
};

describe("M5 SEO — F20 Core Web Vitals, Image Sizing & Hydration Deferral", () => {
	it("uses opacity-free academy-settle without stagger delays on LCP hero recipes", () => {
		const layoutRecipe = read("../../../packages/design-system/src/recipes/academyLayout.ts");
		const mastheadTitle = slotBlock(layoutRecipe, "mastheadTitle");
		const mastheadDescription = slotBlock(layoutRecipe, "mastheadDescription");
		expect(mastheadTitle).toContain('animation: "academy-settle"');
		expect(mastheadTitle).not.toContain("academy-rise");
		expect(mastheadDescription).toContain('animation: "academy-settle"');
		expect(mastheadDescription).not.toContain("academy-rise");
		expect(mastheadDescription).not.toContain("animationDelay");

		const pageRecipe = read("../../../packages/design-system/src/recipes/academyPage.ts");
		const titleLine = slotBlock(pageRecipe, "titleLine");
		const heroLede = slotBlock(pageRecipe, "heroLede");
		expect(titleLine).toContain('animation: "academy-settle"');
		expect(titleLine).not.toContain("academy-rise");
		expect(titleLine).not.toContain("animationDelay");
		expect(heroLede).toContain('animation: "academy-settle"');
		expect(heroLede).not.toContain("academy-rise");
		expect(heroLede).not.toContain("animationDelay");
	});

	it("specifies explicit width and height attributes on masthead and catalog card images", () => {
		const masthead = read("src/components/academy/AcademyCatalogMasthead.astro");
		expect(masthead).toContain("width={tile.w * 64}");
		expect(masthead).toContain("height={tile.h * 64}");

		const catalogCard = read("src/components/academy/AcademyCatalogCard.astro");
		expect(catalogCard).toContain('width="640" height="360"');

		const showCard = read("src/components/show/ShowCard.astro");
		expect(showCard).toContain('width="640" height="360"');
	});

	it("resizes remote video thumbnails via Cloudflare Image Resizing helpers", () => {
		const continueRail = read("src/components/video/ContinueWatchingRail.astro");
		expect(continueRail).toContain("getVideoThumbnailResizedUrl(video.data.id, 640)");

		const showSection = read("src/components/video/ShowVideoSection.astro");
		expect(showSection).toContain("resizeRemoteImageUrl(video.thumbnailUrl, 320)");
		expect(showSection).not.toContain("<style");

		const techSection = read("src/components/video/TechnologyVideoSection.astro");
		expect(techSection).toContain("resizeRemoteImageUrl(video.thumbnailUrl, 320)");
		expect(techSection).not.toContain("<style");
	});

	it("defers non-critical client islands and replaces react-medium-image-zoom with native SSR dialog zoom", async () => {
		const header = read("src/components/shell/AcademyHeader.astro");
		expect(header).toContain('<ThemeToggle client:idle variant="icon" size="md" />');
		expect(header).toContain('<MobileNavigation client:media="(max-width: 1023px)"');

		const reactions = read("src/components/video/VideoReactions.astro");
		expect(reactions).toContain("<VideoReactionsClient client:visible");

		const island = read("src/components/content/RichTextIsland.astro");
		expect(island).not.toContain("react-medium-image-zoom");
		expect(island).toContain('<dialog class="rt-zoom-dialog"');
		expect(island).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|oklch\(/);

		const { ast } = await parse(island);
		expect(ast.children.length).toBeGreaterThan(0);
		const compiled = await transform(island, {
			filename: "src/components/content/RichTextIsland.astro",
		});
		expect(
			compiled.diagnostics.filter((diagnostic) => diagnostic.severity === 1),
		).toEqual([]);
	});
});
