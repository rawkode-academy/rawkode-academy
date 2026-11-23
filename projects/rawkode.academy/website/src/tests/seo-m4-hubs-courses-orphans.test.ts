import { readFileSync } from "node:fs";
import { parse, transform } from "@astrojs/compiler";
import { describe, expect, it } from "vitest";
import {
	navigationGroups,
	primaryNavigation,
} from "../lib/navigation";

const read = (path: string) => readFileSync(path, "utf8");

describe("M4 SEO — F17 Technology Hubs & Matrix", () => {
	it("aligns technology/[id].astro noindex with isTechnologyIndexable, adds courses, and resizes thumbnails", () => {
		const source = read("src/pages/technology/[id].astro");
		expect(source).toContain("isTechnologyIndexable");
		expect(source).toContain("getVideoThumbnailResizedUrl");
		expect(source).toContain('getCollection("courses")');
		expect(source).toContain('"courses"');
		expect(source).toContain("useImageDirectly={false}");
	});

	it("TopicHub.astro renders published courses for the topic and clears duplicate video alt text", () => {
		const source = read("src/components/technology/TopicHub.astro");
		expect(source).toContain("showCourses = true");
		expect(source).toContain("courseLimit = 6");
		expect(source).toContain('getCollection("courses")');
		expect(source).toContain("/courses/${course.id}");
		expect(source).toContain("!hasCourses");
		expect(source).toContain('<img src={video.thumbnailUrl} alt="" class={s.image}');
	});

	it("matrix.astro and advanced.astro expose crawlable links, article counts, breadcrumbs, and CollectionPage + ItemList JSON-LD", () => {
		const matrix = read("src/pages/technology/matrix.astro");
		expect(matrix).toContain("articleCountsByTech");
		expect(matrix).toContain('"articles"');
		expect(matrix).not.toContain('articleCount: 0');
		expect(matrix).not.toContain('data-article-count="0"');
		expect(matrix).toContain('pageType="CollectionPage"');
		expect(matrix).toContain("<BreadcrumbJsonLd");
		expect(matrix).toContain("<Breadcrumb");
		expect(matrix).toContain('"@type": "ItemList"');
		expect(matrix).toContain("itemListTechnologies");
		expect(matrix).toContain('rel="nofollow"');
		expect(matrix).toContain('href={`/technology/${tech.id}`}');
		expect(matrix).toContain('width="28" height="28"');
		expect(matrix).toContain('width="18" height="18"');
		expect(matrix).toContain('<h2 class="lane-title">{lane.label}</h2>');
		expect(matrix).toContain('<h2 id="modal-tech-name" class="modal-name"></h2>');
		expect(matrix).not.toContain('id="modal-icon" src=""');
		expect(matrix).not.toContain('id="modal-cta-link" href=""');
		expect(matrix).toContain("e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0");

		const advanced = read("src/pages/technology/matrix/advanced.astro");
		expect(advanced).toContain("articleCountsByTech");
		expect(advanced).toContain('"articles"');
		expect(advanced).not.toContain("TODO: wire up when available");
		expect(advanced).toContain('pageType="CollectionPage"');
		expect(advanced).toContain("<BreadcrumbJsonLd");
		expect(advanced).toContain("<Breadcrumb");
		expect(advanced).toContain('"@type": "ItemList"');
		expect(advanced).toContain("<TechnologyExplorer\n\t\t\t\tclient:idle");
	});

	it("Explorer Vue components maintain heading hierarchy, image dimensions, sr-only rationale, and modifier-click navigation", () => {
		const gridView = read("src/components/explorer/views/GridView.vue");
		expect(gridView).toContain(':aria-label="tech.name"');
		expect(gridView).toContain('width="22"');
		expect(gridView).toContain('height="22"');
		expect(gridView).toContain("tech.cardData.why");
		expect(gridView).toContain("onTechClick($event, tech.id)");
		expect(gridView).toContain("<h2>No technologies match</h2>");
		expect(gridView).toContain(".empty-state h2 {");

		const filterPanel = read("src/components/explorer/controls/FilterPanel.vue");
		expect(filterPanel).toContain('<h2 class="filter-title">Filters</h2>');
		expect(filterPanel).not.toContain('<h3 class="filter-title">Filters</h3>');

		const explorer = read("src/components/explorer/TechnologyExplorer.vue");
		expect(explorer).toContain('<h2 class="control-label">Axes</h2>');
		expect(explorer).toContain('<h3 class="control-label">Axes</h3>');
		expect(explorer).toContain("<h2>Scatter View</h2>");
		expect(explorer).toContain("<h2>Timeline View</h2>");
		expect(explorer).toContain("<h2>Treemap View</h2>");
		expect(explorer).toContain("<h2>Sankey Flow View</h2>");
		expect(explorer).toContain(".coming-soon h2 {");
	});
});

describe("M4 SEO — F18 Courses Metadata, Breadcrumbs & Resizing", () => {
	it("CourseDetailHero renders optional breadcrumbs and technology pills", () => {
		const hero = read("src/components/courses/CourseDetailHero.vue");
		expect(hero).toContain("academyNavigation");
		expect(hero).toContain("academyDocument");
		expect(hero).toContain("breadcrumbs?: BreadcrumbItem[]");
		expect(hero).toContain("technologies?: TechnologyTag[]");
		expect(hero).toContain('aria-label="Breadcrumb"');
		expect(hero).toContain('`/technology/${tech.id}`');
	});

	it("courses/[...slug].astro emits CourseJsonLd unconditionally and passes breadcrumbs and technologies", () => {
		const coursePage = read("src/pages/courses/[...slug].astro");
		expect(coursePage).not.toMatch(/\{imageUrl\s*&&\s*\(\s*<CourseJsonLd/);
		expect(coursePage).toContain("getEntries(course.data.technologies ?? [])");
		expect(coursePage).not.toContain('getCollection("technologies")');
		expect(coursePage).toContain("breadcrumbs={[");
		expect(coursePage).toContain("technologies={technologies.map(");
	});

	it("courses/[course]/[slug].astro emits CourseJsonLd, VideoMetadata, SSR video fallback, curriculum, and technology links", () => {
		const lessonPage = read("src/pages/courses/[course]/[slug].astro");
		expect(lessonPage).toContain("<CourseJsonLd");
		expect(lessonPage).toContain("isModule={true}");
		expect(lessonPage).toContain("<VideoMetadata");
		expect(lessonPage).toContain('slot="fallback"');
		expect(lessonPage).toContain("<noscript>");
		expect(lessonPage).toContain("Open the lesson video stream (HLS)");
		expect(lessonPage).toContain('/people/${author.data.id}');
		expect(lessonPage).toContain('/technology/${tech.id}');
		expect(lessonPage).toContain("Course curriculum (");
		expect(lessonPage).toContain("client:idle");
		expect(lessonPage).not.toContain("client:load");
	});

	it("courses/index.astro links featured course title and resizes catalog imagery", () => {
		const catalogPage = read("src/pages/courses/index.astro");
		expect(catalogPage).toContain("resizeRemoteImageUrl");
		expect(catalogPage).toContain('<h2 class={catalog.featuredTitle}>\n\t\t\t\t\t\t\t<a href={`/courses/${featuredCourse.id}`}>{featuredCourse.data.title}</a>\n\t\t\t\t\t\t</h2>');
		expect(catalogPage).toContain("resizeRemoteImageUrl(src, 384)");
		expect(catalogPage).toContain("resizeRemoteImageUrl(courseImages.get(featuredCourse.id)!, 960)");
		expect(catalogPage).toContain("resizeRemoteImageUrl(coverSrc, 640)");
	});
});

describe("M4 SEO — F19 Cheat Sheet, Games, Navigation & Organizations", () => {
	it("1.35-cheatsheet.astro renders full SSR content unconditionally with Breadcrumb and inline CTA", () => {
		const sheet = read("src/pages/resources/kubernetes/1.35-cheatsheet.astro");
		expect(sheet).not.toContain("{hasAccess ?");
		expect(sheet).toContain("<Breadcrumb");
		expect(sheet).toContain("What's New in Kubernetes 1.35");
		expect(sheet).toContain("<K8sCheatsheetCTA");
		expect(sheet).toContain("isSubscribed={hasSubscribed}");
		expect(sheet).toContain('href="/technology/kubernetes"');
	});

	it("game pages expose SSR breadcrumbs, single h1, and internal links unconditionally", () => {
		for (const gamePath of [
			"src/pages/games/kubele/index.astro",
			"src/pages/games/secret-of-kubernetes-island/index.astro",
			"src/pages/games/cnicon/index.astro",
		]) {
			const source = read(gamePath);
			expect(source).toContain("<Breadcrumb");
			expect(source).toContain('href="/technology/kubernetes"');
			expect(source).toContain('href="/technology"');
			expect(source).toContain('href="/technology/matrix"');
			expect(source.match(/<h1\b/g)).toHaveLength(1);
		}
		const cnicon = read("src/pages/games/cnicon/index.astro");
		expect(cnicon).toContain("<h2>Sign in to play</h2>");
		expect(cnicon).not.toContain("<h1>CNIcon</h1>");
		expect(cnicon).toContain(".sign-in-card h2 {");
	});

	it("global navigation exposes previously orphaned routes and forwards rel=nofollow on /settings", () => {
		const allHrefs = navigationGroups.flatMap((g) => g.items.map((i) => i.href));
		expect(allHrefs).toContain("/series");
		expect(allHrefs).toContain("/resources/kubernetes/1.35-cheatsheet");
		expect(allHrefs).toContain("/supporters");
		expect(allHrefs).toContain("/games/secret-of-kubernetes-island");
		expect(allHrefs).toContain("/organizations/lets-chat");

		const settingsItem = navigationGroups
			.flatMap((g) => g.items)
			.find((i) => i.href === "/settings");
		expect(settingsItem?.rel).toBe("nofollow");

		for (const navItem of primaryNavigation) {
			expect(navItem.href).toBeTruthy();
		}

		expect(read("src/components/shell/AcademyFooter.astro")).toContain("rel={item.rel}");
		const header = read("src/components/shell/AcademyHeader.astro");
		expect(header).toContain("rel={item.rel}");
		expect(header).toContain('href="/settings" rel="nofollow"');
		expect(
			read("../../../packages/design-system/src/vue/NavigationDrawer.vue"),
		).toContain(':rel="item.rel"');
	});

	it("organization pages cross-link /organizations/lets-chat and /supporters safely", () => {
		const letsChat = read("src/pages/organizations/lets-chat.astro");
		expect(letsChat).toContain('pageType="ContactPage"');
		expect(letsChat).toContain('href="/supporters"');

		const partnerships = read("src/pages/organizations/partnerships/index.astro");
		expect(partnerships).toContain('href="/organizations/lets-chat"');

		const support = read("src/pages/organizations/support-our-work/index.astro");
		expect(support).toContain('href="/organizations/lets-chat"');
		// Contract requirement from supporters-contract-ssr.test.mjs:
		expect(support).not.toContain('href="/supporters"');
	});
});

describe("M4 SEO — Astro template compilation", () => {
	it.each([
		"src/pages/technology/[id].astro",
		"src/components/technology/TopicHub.astro",
		"src/pages/technology/matrix.astro",
		"src/pages/technology/matrix/advanced.astro",
		"src/pages/courses/index.astro",
		"src/pages/courses/[...slug].astro",
		"src/pages/courses/[course]/[slug].astro",
		"src/pages/resources/kubernetes/1.35-cheatsheet.astro",
		"src/pages/games/kubele/index.astro",
		"src/pages/games/secret-of-kubernetes-island/index.astro",
		"src/pages/games/cnicon/index.astro",
		"src/components/shell/AcademyHeader.astro",
		"src/components/shell/AcademyFooter.astro",
		"src/pages/organizations/lets-chat.astro",
		"src/pages/organizations/partnerships/index.astro",
		"src/pages/organizations/support-our-work/index.astro",
	])("compiles %s cleanly with @astrojs/compiler", async (path) => {
		const source = read(path);
		const { ast } = await parse(source);
		expect(ast.children.length).toBeGreaterThan(0);
		const compiled = await transform(source, { filename: path });
		expect(
			compiled.diagnostics.filter((diagnostic) => diagnostic.severity === 1),
		).toEqual([]);
	});
});
