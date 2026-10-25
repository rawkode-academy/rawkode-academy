import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse, transform } from "@astrojs/compiler";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import * as runtime from "astro/runtime/server/index.js";
import ts from "typescript";
import { webcontainerDemosPlugin } from "../utils/vite-plugin-webcontainer-demos";
import { getCourseModuleSlug } from "../utils/course-path";
import { localTime } from "../lib/local-time";
import { setContentEnv } from "../lib/live-content/env";
import { resetContentCacheForTests } from "../lib/live-content/kv-cache";
import { contentLoader } from "../lib/live-content/loader";
import { memoryKv } from "./live-content/memory-kv";

const read = (path: string) => readFileSync(path, "utf8");
const moduleEntry = (
	id: string,
	order: number,
	draft = false,
	duration?: number,
) => ({
	id,
	data: {
		course: { id: "course" },
		title: id,
		description: `About ${id}`,
		order,
		draft,
		duration,
	},
});
const course = {
	id: "course",
	data: {
		title: "A course",
		description: "Course description",
		publishedAt: new Date("2026-01-01"),
		difficulty: "beginner",
		authors: [],
	},
};

// Gateway fixture for the course webcontainer/media contracts, copied from the
// platform-courses seed (complete-guide-zitadel). It goes through the real live
// loader (LiveCourses query -> mapper -> entries), so the assertions cover the
// shape the website receives from D1. The draft lesson's demo is fictional: it
// checks that unpublished lessons do not count.
const zitadel = "complete-guide-zitadel";
const thumbnail = (id: string) => ({
	id,
	thumbnailUrl: `https://content.rawkode.academy/videos/${id}/thumbnail.jpg`,
});
const webcontainer = (src: string, startCommand: string) => ({
	title: src,
	type: "embed",
	category: "code",
	embedConfig: {
		container: "webcontainer",
		src,
		height: "800px",
		width: "100%",
		importLocalDir: `${zitadel}/${src}`,
		startCommand,
	},
});
const gatewayLesson = (
	slug: string,
	order: number,
	extra: Record<string, unknown> = {},
) => ({
	id: `${zitadel}/${slug}`,
	courseId: zitadel,
	slug,
	title: slug,
	description: `About ${slug}`,
	order,
	publishedAt: "2025-07-02T00:00:00Z",
	draft: false,
	authors: [{ id: "rawkode" }],
	...extra,
});
const LIVE_COURSES = {
	allCourses: [
		{
			id: zitadel,
			title: "Zitadel",
			description: "Zitadel course",
			publishedAt: "2025-07-02T00:00:00Z",
			difficulty: "intermediate",
			authors: [{ id: "rawkode" }],
			technologies: [],
			learningPath: [],
			modules: [
				gatewayLesson("01-introduction", 1, {
					video: thumbnail("hgg3yhgkk4jn9l7ryjw9ebs8"),
					resources: [
						{
							title: "Zitadel Documentation",
							type: "url",
							url: "https://zitadel.com/docs",
							category: "documentation",
						},
						webcontainer("oauth-pkce-app", "bun run dev"),
					],
				}),
				gatewayLesson("02-prerequisites", 2, {
					video: thumbnail("a5uhh9oosvj8ytch0tf84uja"),
				}),
				gatewayLesson("03-install-docker-compose", 3, {
					video: thumbnail("fh6co0t0jsacv1wou1q7iyj7"),
				}),
				gatewayLesson("04-install-kubernetes", 4, {
					video: thumbnail("b7bcg1fl06z4q9529ryalcj2"),
				}),
				gatewayLesson("05-zitadel-cloud", 5, {
					video: thumbnail("wcktaod7wsyzhg7rm0z3p1s3"),
				}),
				gatewayLesson("06-first-application", 6, {
					video: thumbnail("g4uh2a6tw6koxe1d2ywrftyr"),
					resources: [webcontainer("oauth-pkce-demo", "npm run dev")],
				}),
				gatewayLesson("08-remix-integration", 8, {
					draft: true,
					resources: [webcontainer("unpublished-demo", "npm run dev")],
				}),
			],
		},
	],
};
async function gatewayModules() {
	const API = {
		fetch: vi.fn(async (request: Request) => {
			const { operationName } = (await request.json()) as {
				operationName: string;
			};
			expect(operationName).toBe("LiveCourses");
			return Response.json({ data: LIVE_COURSES });
		}),
	};
	setContentEnv({ API, CONTENT_CACHE: memoryKv() } as never);
	const result = await contentLoader("courseModules").loadCollection({
		filter: undefined,
	} as never);
	if ("error" in result) throw result.error;
	return result.entries;
}
beforeEach(() =>
	resetContentCacheForTests(() => Date.parse("2026-10-23T12:00:00Z")),
);
afterEach(() => setContentEnv(undefined));

// Run actual Astro frontmatter with supplied collections/locals, not a parallel
// implementation of its data projection. No content build or external calls.
async function frontmatter(
	path: string,
	dependencies: Record<string, unknown>,
	result: string,
) {
	const { ast } = await parse(read(path));
	const front = ast.children.find((node) => node.type === "frontmatter");
	if (!front || front.type !== "frontmatter")
		throw new Error("Missing frontmatter");
	const source = ts.createSourceFile(
		"fixture.ts",
		front.value,
		ts.ScriptTarget.Latest,
		true,
	);
	const statements = source.statements
		.filter((node) => !ts.isImportDeclaration(node))
		.map((node) => node.getText(source).replace(/^export\s+/, ""))
		.join("\n");
	const code = ts.transpileModule(statements, {
		compilerOptions: {
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.ESNext,
		},
	}).outputText;
	const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
	return new AsyncFunction(
		...Object.keys(dependencies),
		code + `\nreturn ${result};`,
	)(...Object.values(dependencies));
}
async function jsonLd(modules: ReturnType<typeof moduleEntry>[]) {
	return frontmatter(
		"src/components/html/course-jsonld.astro",
		{
			Astro: {
				props: { course, modules, authors: [] },
				site: new URL("https://example.test"),
			},
		},
		"courseJsonLd",
	);
}
afterEach(() => expect(fetch).not.toHaveBeenCalled());

describe("truthful course structured data", () => {
	it("excludes drafts and omits fabricated duration when any published duration is unknown", async () => {
		const data = await jsonLd([
			moduleEntry("one", 1, false, 12),
			moduleEntry("draft", 2, true, 100),
			moduleEntry("three", 3),
		]);
		expect(data.teaches).toEqual(["one", "three"]);
		expect(data.hasCourseInstance).toHaveLength(2);
		expect(data.hasCourseInstance[0].courseWorkload).toBe("PT12M");
		expect(data.hasCourseInstance[1]).not.toHaveProperty("courseWorkload");
		expect(data).not.toHaveProperty("timeRequired");
	});
	it("sums only measured published durations", async () => {
		const data = await jsonLd([
			moduleEntry("one", 1, false, 12),
			moduleEntry("draft", 2, true, 100),
			moduleEntry("three", 3, false, 8),
		]);
		expect(data.timeRequired).toBe("PT20M");
	});
	it.each([
		undefined,
		0,
		-1,
		Number.NaN,
		Number.POSITIVE_INFINITY,
	])("omits unusable duration %s", async (duration) => {
		const data = await jsonLd([moduleEntry("one", 1, false, duration)]);
		expect(data).not.toHaveProperty("timeRequired");
		expect(data.hasCourseInstance[0]).not.toHaveProperty("courseWorkload");
	});
	it("does not advertise an announced course as in stock or zero minutes", async () => {
		const data = await jsonLd([moduleEntry("draft", 1, true, 30)]);
		expect(data.teaches).toEqual([]);
		expect(data).not.toHaveProperty("hasCourseInstance");
		expect(data).not.toHaveProperty("timeRequired");
		expect(data.offers).not.toHaveProperty("availability");
	});
});

describe("catalog availability and curriculum", () => {
	async function catalog(modules: ReturnType<typeof moduleEntry>[]) {
		const Astro = {};
		const cacheCalls: unknown[][] = [];
		const result = await frontmatter(
			"src/pages/courses/index.astro",
			{
				Astro,
				getCollection: async (name: string) =>
					name === "courses" ? [course] : modules,
				getEntries: async () => [],
				setContentCache: async (...args: unknown[]) => {
					cacheCalls.push(args);
				},
				getCourseModuleSlug,
				localTime,
				academyLayout: () => ({}),
				academyCatalog: () => ({}),
			},
			"({availabilityLabel, firstModuleSlug, featuredAvailableModuleCount})",
		);
		// The catalog lists courses and their lessons: both collections tag the
		// page and cap its maxAge at their next scheduled entry.
		expect(cacheCalls).toEqual([
			[
				Astro,
				{
					entries: [course, ...modules],
					collections: ["courses", "courseModules"],
				},
			],
		]);
		return result;
	}
	it("announces empty courses and chooses the first published lesson", async () => {
		const announced = await catalog([moduleEntry("course/draft", 1, true)]);
		expect(announced.availabilityLabel("course")).toBe(
			"Announced · no lessons available yet",
		);
		expect(announced.firstModuleSlug).toBeUndefined();
		const available = await catalog([
			moduleEntry("course/draft", 1, true),
			moduleEntry("course/two", 3),
			moduleEntry("course/one", 2),
		]);
		expect(available.availabilityLabel("course")).toBe("2 lessons available");
		expect(available.firstModuleSlug).toBe("one");
		expect(available.featuredAvailableModuleCount).toBe(2);
		expect(read("src/pages/courses/index.astro")).toContain(
			'firstModuleSlug ? "Start the course →" : "View course plan →"',
		);
		expect(read("src/pages/courses/index.astro")).not.toContain("<style>");
	});
	it("renders published-only curriculum ordinals and unlinked, unnumbered drafts", async () => {
		const compiled = await transform(
			read("src/components/courses/CourseModules.astro"),
		);
		expect(compiled.diagnostics).toEqual([]);
		const code = ts.transpileModule(compiled.code, {
			compilerOptions: {
				module: ts.ModuleKind.CommonJS,
				target: ts.ScriptTarget.ES2022,
			},
		}).outputText;
		const imports: Record<string, unknown> = {
			"astro/runtime/server/index.js": {
				...runtime,
				createMetadata: () => ({}),
			},
			"@/lib/live-content": {
				// The page passes its modules; the component must not refetch them.
				getCollection: () => {
					throw new Error("CourseModules refetched modules");
				},
			},
			"@/utils/course-path": { getCourseModuleSlug },
			"@rawkodeacademy/design-system": {
				academyCourse: () => new Proxy({}, { get: (_, slot) => String(slot) }),
			},
		};
		const exports: Record<string, any> = {};
		new Function("require", "exports", code)((id: string) => {
			if (!(id in imports)) throw new Error(id);
			return imports[id];
		}, exports);
		const container = await AstroContainer.create();
		const html = await container.renderToString(exports.default, {
			props: {
				course,
				modules: [
					moduleEntry("course/one", 1),
					moduleEntry("course/draft", 2, true),
					moduleEntry("course/three", 3),
				],
			},
		});
		const dom = document.createElement("div");
		dom.innerHTML = html;
		expect(
			[...dom.querySelectorAll("a .lessonIndex")].map(
				(node) => node.textContent,
			),
		).toEqual(["01", "02"]);
		expect(dom.querySelector(".unpublished .lessonIndex")?.textContent).toBe(
			"—",
		);
		expect(dom.querySelectorAll("a")).toHaveLength(2);
		expect(dom.querySelector('a[href="/courses/course/draft"]')).toBeNull();
		expect(
			[...dom.querySelectorAll("li[value]")].map((node) =>
				node.getAttribute("value"),
			),
		).toEqual(["1", "2"]);
	});
});

describe("server-rendered course routes", () => {
	const styleProxy = () => new Proxy({}, { get: (_, slot) => String(slot) });
	const lessons = [
		moduleEntry("course/one", 1),
		moduleEntry("course/draft", 2, true),
		moduleEntry("course/three", 3),
	];
	const otherCourseLesson = {
		...moduleEntry("other/elsewhere", 1),
		data: {
			...moduleEntry("other/elsewhere", 1).data,
			course: { id: "other" },
		},
	};
	function dependencies(params: Record<string, string>) {
		const cacheCalls: unknown[][] = [];
		const Astro = {
			params,
			site: new URL("https://example.test"),
			url: new URL(
				`https://example.test/courses/${Object.values(params).join("/")}`,
			),
		};
		const all = [...lessons, otherCourseLesson];
		return {
			cacheCalls,
			deps: {
				Astro,
				getEntry: async (name: string, id: string) =>
					name === "courses"
						? id === course.id
							? course
							: undefined
						: all.find((lesson) => lesson.id === id),
				getEntries: async () => [],
				getCollection: async (
					name: string,
					filter?: (entry: (typeof all)[number]) => unknown,
				) => {
					expect(name).toBe("courseModules");
					return filter ? all.filter(filter) : all;
				},
				renderEntry: async () => ({ html: "<p>Body</p>", headings: [] }),
				setContentCache: async (...args: unknown[]) => {
					cacheCalls.push(args);
				},
				getCourseModuleSlug,
				academyDocument: styleProxy,
				academyLayout: styleProxy,
				academyCourse: styleProxy,
			},
		};
	}
	const lessonPage = "src/pages/courses/[course]/[slug].astro";
	it.each([
		["a draft lesson", { course: "course", slug: "draft" }],
		["a missing lesson", { course: "course", slug: "missing" }],
		["a missing course", { course: "missing", slug: "one" }],
		["a lesson of another course", { course: "course", slug: "elsewhere" }],
	])("returns 404 without caching for %s", async (_, params) => {
		const { deps, cacheCalls } = dependencies(params);
		const result = await frontmatter(lessonPage, deps, "undefined");
		expect(result).toBeInstanceOf(Response);
		expect(result.status).toBe(404);
		expect(cacheCalls).toEqual([]);
	});
	it("navigates between published lessons and tags the page with what it shows", async () => {
		const { deps, cacheCalls } = dependencies({
			course: "course",
			slug: "three",
		});
		const result = await frontmatter(
			lessonPage,
			deps,
			"({currentIndex, previousModule, nextModule, allCourseModules, html})",
		);
		expect(result.allCourseModules.map((lesson: any) => lesson.id)).toEqual([
			"course/one",
			"course/three",
		]);
		expect(result.currentIndex).toBe(1);
		expect(result.previousModule.id).toBe("course/one");
		expect(result.nextModule).toBeNull();
		expect(result.html).toBe("<p>Body</p>");
		expect(cacheCalls).toEqual([
			[
				deps.Astro,
				{
					entries: [lessons[2], course, lessons[0], lessons[2]],
					collections: ["courseModules", "technologies"],
				},
			],
		]);
	});
	it("returns 404 for an unknown course and tags a known one with its curriculum", async () => {
		const missing = dependencies({ slug: "missing" });
		const notFound = await frontmatter(
			"src/pages/courses/[...slug].astro",
			missing.deps,
			"undefined",
		);
		expect(notFound.status).toBe(404);
		expect(missing.cacheCalls).toEqual([]);
		const { deps, cacheCalls } = dependencies({ slug: "course" });
		const result = await frontmatter(
			"src/pages/courses/[...slug].astro",
			deps,
			"({totalModules, availableModuleCount, allCourseModules})",
		);
		expect(result.totalModules).toBe(3);
		expect(result.availableModuleCount).toBe(2);
		expect(cacheCalls).toEqual([
			[
				deps.Astro,
				{
					entries: [course, ...lessons],
					collections: ["courseModules", "technologies"],
				},
			],
		]);
	});
});

describe("authored course contracts", () => {
	it.each([
		[
			"[course]/[slug].astro",
			"CourseSignupForm",
			"/courses/course/lesson",
			"lesson",
		],
		["[...slug].astro", "CourseSignupFormCompact", "/courses/course", "course"],
	])("server-renders %s actual deferred fallback with a local retry and no-JS explanation", async (route, component, path, content) => {
		const source = read(`src/pages/courses/${route}`);
		const { ast } = await parse(source);
		let signup: any;
		const walk = (node: any) => {
			if (node.name === component) signup = node;
			for (const child of node.children ?? []) walk(child);
		};
		walk(ast);
		expect(
			signup.attributes.some(
				(attribute: any) => attribute.name === "server:defer",
			),
		).toBe(true);
		expect(
			signup.children.some((node: any) =>
				node.attributes?.some(
					(attribute: any) =>
						attribute.name === "slot" && attribute.value === "fallback",
				),
			),
		).toBe(true);
		// Render the actual slot markup, not copied fallback prose. This isolates
		// its SSR contract from the island endpoint and provider dependencies.
		const fallback = source.match(/<p slot="fallback"[\s\S]*?<\/p>/)?.[0];
		expect(fallback).toBeDefined();
		const compiled = await transform(
			`---\nconst doc = { copy: "copy" }; const s = doc;\n---\n${fallback!.replace(' slot="fallback"', "")}`,
		);
		const code = ts.transpileModule(compiled.code, {
			compilerOptions: {
				module: ts.ModuleKind.CommonJS,
				target: ts.ScriptTarget.ES2022,
			},
		}).outputText;
		const exports: Record<string, any> = {};
		new Function("require", "exports", code)((id: string) => {
			expect(id).toBe("astro/runtime/server/index.js");
			return { ...runtime, createMetadata: () => ({}) };
		}, exports);
		const container = await AstroContainer.create();
		const html = await container.renderToString(exports.default, {
			request: new Request(`https://example.test${path}`),
		});
		const dom = document.createElement("div");
		dom.innerHTML = html;
		expect(dom.textContent).toContain("Loading optional course email signup");
		expect(dom.textContent).toContain("If it does not load");
		expect(dom.textContent).toContain("Signup requires JavaScript");
		expect(dom.textContent).toContain(
			`all ${content} content remains available without signing up`,
		);
		expect(dom.querySelector("a")?.getAttribute("href")).toBe(path);
		expect(dom.querySelector("script, form, input")).toBeNull();
	});
	it.each([
		"pages/courses/index.astro",
		"pages/courses/[...slug].astro",
		"pages/courses/[course]/[slug].astro",
		"components/courses/CourseSignupForm.astro",
		"components/courses/CourseSignupFormCompact.astro",
		"components/courses/CourseModules.astro",
		"components/html/course-jsonld.astro",
		"pages/learning-paths/index.astro",
		"pages/learning-paths/[slug].astro",
		"components/html/learning-path-jsonld.astro",
		"components/html/learning-path-itemlist-jsonld.astro",
	])("compiles the changed Astro source %s without errors", async (path) => {
		const result = await transform(read(`src/${path}`), { filename: path });
		expect(
			result.diagnostics.filter((diagnostic) => diagnostic.severity === 1),
		).toEqual([]);
	});
	it("resolves every published WebContainer reference through the actual demo registry", async () => {
		const plugin = webcontainerDemosPlugin();
		await plugin.configResolved!({});
		const registry = await plugin.load!("\0virtual:webcontainer-demos");
		expect(registry).toBeTruthy();
		let demos = 0;
		for (const lesson of await gatewayModules()) {
			if (lesson.data.draft !== false) continue;
			for (const resource of lesson.data.resources ?? []) {
				if (resource.embedConfig?.container !== "webcontainer") continue;
				demos++;
				// ResourceList opens /embed/webcontainer?course=<course>&resource=<src>,
				// which loads the demo registered under "<course>/<src>".
				const key = `${lesson.data.course.id}/${resource.embedConfig.src}`;
				expect(registry).toContain(`'${key}':`);
				expect(resource.embedConfig.import?.localDir).toBe(key);
			}
		}
		expect(demos).toBe(2);
	});
	it.each([
		["02-prerequisites", "a5uhh9oosvj8ytch0tf84uja"],
		["03-install-docker-compose", "fh6co0t0jsacv1wou1q7iyj7"],
		["04-install-kubernetes", "b7bcg1fl06z4q9529ryalcj2"],
		["05-zitadel-cloud", "wcktaod7wsyzhg7rm0z3p1s3"],
	])("preserves %s media identity in shared lesson metadata", async (slug, id) => {
		const lesson = (await gatewayModules()).find(
			(candidate) => candidate.id === `complete-guide-zitadel/${slug}`,
		);
		expect(lesson?.data.video).toEqual({
			id,
			thumbnailUrl: `https://content.rawkode.academy/videos/${id}/thumbnail.jpg`,
		});
		// The lesson page plays the video from that metadata, not from the body.
		const source = read("src/pages/courses/[course]/[slug].astro");
		expect(source).toContain("video={module.data.video.id}");
		expect(source).toContain(
			'thumbnailUrl={module.data.video.thumbnailUrl || module.data.video.poster || ""}',
		);
	});
	// The authored-prose contracts that used to read content/courses/**/*.mdx
	// ("retains teaching sections while removing literal duplicated page
	// introduction", "only asserts internal tutorial path, dependency and control
	// consistency") moved with the content to D1: the lesson bodies are seeded and
	// validated by the platform courses service, not by website files.
	it.each([
		"src/pages/courses/index.astro",
		"src/pages/courses/[...slug].astro",
		"src/pages/courses/[course]/[slug].astro",
		"src/pages/learning-paths/index.astro",
		"src/pages/learning-paths/[slug].astro",
	])("server-renders %s from the live content layer with cache tags", (path) => {
		const source = read(path);
		expect(source).toContain("export const prerender = false;");
		expect(source).not.toMatch(/getStaticPaths|astro:content|astro:assets/);
		expect(source).toContain('from "@/lib/live-content"');
		expect(source.match(/await setContentCache\(Astro, \{/g)).toHaveLength(1);
	});
	it.each([
		"src/components/courses/CourseModules.astro",
		"src/components/html/course-jsonld.astro",
		"src/components/html/learning-path-jsonld.astro",
		"src/components/html/learning-path-itemlist-jsonld.astro",
	])("%s reads live entries and never sets page cache headers", (path) => {
		const source = read(path);
		expect(source).not.toContain("astro:content");
		expect(source).not.toContain("setContentCache");
	});
	it("defers course signup state to requests and preserves the originating page path", async () => {
		for (const [route, component] of [
			["[...slug].astro", "CourseSignupFormCompact"],
			["[course]/[slug].astro", "CourseSignupForm"],
		]) {
			const source = read(`src/pages/courses/${route}`);
			const { ast } = await parse(source);
			const nodes: any[] = [];
			const walk = (node: any) => {
				if (node.name === component) nodes.push(node);
				for (const child of node.children ?? []) walk(child);
			};
			walk(ast);
			expect(nodes).toHaveLength(1);
			expect(
				nodes[0].attributes.some(
					(attribute: any) => attribute.name === "server:defer",
				),
			).toBe(true);
			expect(
				nodes[0].attributes.find(
					(attribute: any) => attribute.name === "pagePath",
				)?.value,
			).toBe("Astro.url.pathname");
			expect(
				nodes[0].attributes.some(
					(attribute: any) => attribute.name === "isAlreadySubscribed",
				),
			).toBe(false);
		}
	});
	it.each([
		"CourseSignupForm",
		"CourseSignupFormCompact",
	])("%s uses request locals/session, not a frozen subscription value", async (name) => {
		const calls: unknown[][] = [];
		const result = await frontmatter(
			`src/components/courses/${name}.astro`,
			{
				Astro: {
					props: {
						courseId: "course",
						courseTitle: "Course",
						pagePath: "/courses/course/lesson",
						signupConfig: {
							audienceId: "audience",
							allowSponsorContact: false,
						},
					},
					locals: { user: { email: "reader@example.test" } },
					session: { fixture: true },
					url: new URL("https://example.test/_server-islands/form"),
				},
				isSubscribedToAudience: async (...args: unknown[]) => {
					calls.push(args);
					return true;
				},
			},
			"({isAlreadySubscribed, pagePath})",
		);
		expect(result).toEqual({
			isAlreadySubscribed: true,
			pagePath: "/courses/course/lesson",
		});
		expect(calls).toEqual([
			["audience", "reader@example.test", { fixture: true }],
		]);
	});
});
