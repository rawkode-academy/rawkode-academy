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
	"articles/series/SeriesArticles.astro",
	"show/SubscribeLinks.astro",
	"series/SeriesLink.astro",
];

describe("Academy document migration", () => {
	it.each(detailRoutes)("keeps %s on the canonical shell and Panda recipes", (route) => {
		const page = source(`pages/${route}`);
		expect(page).toContain('from "@/wrappers/page.astro"');
		expect(page).toContain('from "@rawkodeacademy/design-system"');
		expect(page).not.toMatch(/<style\b|@apply|--editorial-|--surface-|class="/);
	});

	it.each(documentComponents)("styles %s without legacy utilities", (component) => {
		const page = source(`components/${component}`);
		expect(page).toContain('from "@rawkodeacademy/design-system"');
		expect(page).not.toMatch(/<style\b|@apply|--editorial-|--surface-|(?<!:)class="/);
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
		expect(curriculum).toContain("getCourseModuleSlug(course.id, module.id)");
		expect(lesson).toContain('client:only="vue"');
		expect(lesson).toContain("loadWebContainerFiles");
		expect(lesson).toContain("dedupedResources.length > 0 && doc.moduleFlowRail");
		expect(lesson).toContain("<ResourceList resources={dedupedResources}");
	});
});
