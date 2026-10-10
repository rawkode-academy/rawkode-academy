import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
	readFileSync(join(process.cwd(), "src", path), "utf8");

const detailRoutes = [
	"read/[...slug].astro",
	"news/[...slug].astro",
	"learning-paths/[slug].astro",
	"series/[...slug].astro",
	"adrs/[...slug].astro",
	"courses/[...slug].astro",
	"courses/[course]/[...slug].astro",
	"shows/[showId].astro",
	"people/[id].astro",
];

const documentComponents = [
	"read/ArticleHeader.astro",
	"read/ArticleByline.astro",
	"read/ArticleTOC.astro",
	"read/EndSlug.astro",
	"read/ReadNext.astro",
	"courses/CourseDetailHero.vue",
	"courses/CourseModules.astro",
	"articles/Resources.astro",
	"articles/Updates.astro",
	"articles/Diagram.astro",
	"articles/series/SeriesArticles.astro",
	"show/SubscribeLinks.astro",
	"series/SeriesLink.astro",
];

describe("Academy document migration", () => {
	it("requires inline diagram rendering instead of silently omitting the integration", () => {
		const config = readFileSync("astro.config.mts", "utf8");
		expect(config).toContain("d2({ inline: true })");
		expect(config).not.toContain("d2Available");
		expect(config).not.toContain("skipping diagram support");
		expect(readFileSync("devenv.nix", "utf8")).toMatch(/\n\s+d2\n/);
	});

	it("navigates without a decorative cross-document text crossfade", () => {
		expect(source("styles/global.css")).not.toContain("@view-transition");
		expect(source("pages/watch/[...slug].astro")).not.toContain(
			"videoTransitionName",
		);
		expect(source("styles/global.css")).toContain(
			"prefers-reduced-motion: reduce",
		);
	});

	it.each(
		detailRoutes,
	)("keeps %s on the canonical shell and Panda recipes", (route) => {
		const page = source(`pages/${route}`);
		expect(page).toContain('from "@/wrappers/page.astro"');
		expect(page).toContain('from "@rawkodeacademy/design-system"');
		expect(page).not.toMatch(/<style\b|@apply|--editorial-|--surface-|class="/);
	});

	it.each(
		documentComponents,
	)("styles %s without legacy utilities", (component) => {
		const page = source(`components/${component}`);
		expect(page).toContain('from "@rawkodeacademy/design-system"');
		expect(page).not.toMatch(
			/<style\b|@apply|--editorial-|--surface-|(?<!:)class="/,
		);
	});

	it("does not render a Discord discussion link at the end of read articles", () => {
		const endSlug = source("components/read/EndSlug.astro");
		expect(endSlug).not.toContain("Discuss in the Discord");
		expect(endSlug).not.toContain("discord.gg/rawkode");
	});

	it("keeps accessible active-location state independent of generated class names", () => {
		const toc = source("components/read/ArticleTOC.astro");
		expect(toc).toContain('aria-label="On this page"');
		expect(toc).toContain('"[data-toc-slug]"');
		expect(toc).toContain('setAttribute("aria-current", "location")');
		expect(toc).not.toContain("classList");
	});

	it("retains course availability, resource, and media integration", () => {
		const curriculum = source("components/courses/CourseModules.astro");
		const lesson = source("pages/courses/[course]/[...slug].astro");
		expect(curriculum).toContain('const Element = isDraft ? "div" : "a"');
		expect(curriculum).toContain("getCourseModuleSlug(course.slug, module.slug)");
		expect(lesson).toContain('client:only="vue"');
		expect(lesson).not.toContain("loadWebContainerFiles");
		const resources = source("components/courses/ResourceList.vue");
		expect(resources).toContain("const resourceId = resource.id || resource.embedConfig.src");
		expect(resources).toContain("new URLSearchParams({");
		expect(resources).toContain("module: moduleSlug");
		expect(resources).toContain("resource: resourceId");
		expect(resources).toContain("/embed/webcontainer?${params.toString()}");
		const embedRoute = source("pages/embed/webcontainer.astro");
		expect(embedRoute).toContain("getWebContainerDemo(courseSlug, fullModuleSlug, resourceKey)");
		expect(embedRoute).toContain("readDemoFiles(demo.files)");
		expect(embedRoute).toContain("export const prerender = false;");
		expect(embedRoute).not.toContain("virtual:webcontainer-demos");
		const payloadContent = source("lib/payload-content.ts");
		expect(payloadContent).toContain('`/v1/demos?${params.toString()}`');
		expect(lesson).toContain(
			"dedupedResources.length > 0 && doc.moduleFlowRail",
		);
		expect(lesson).toContain("const resourceListResources = dedupedResources.map");
		expect(lesson).toContain("<ResourceList resources={resourceListResources}");
		expect(lesson).not.toContain("resource.embedConfig.files");
	});
});
