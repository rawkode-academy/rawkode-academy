import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { parse, transform } from "@astrojs/compiler";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import * as runtime from "astro/runtime/server/index.js";
import ts from "typescript";
import { webcontainerDemosPlugin } from "../utils/vite-plugin-webcontainer-demos";
import { getCourseModuleSlug } from "../utils/course-path";

const contentDir = resolve("../../../content/courses");
const read = (path: string) => readFileSync(path, "utf8");
const entry = (path: string) => parseYaml(read(path).split(/^---\s*$/m)[1]!);
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
		return frontmatter(
			"src/pages/courses/index.astro",
			{
				Astro: {},
				getCollection: async (name: string) =>
					name === "courses" ? [course] : modules,
				getEntries: async () => [],
				getCourseModuleSlug,
				academyLayout: () => ({}),
				academyCatalog: () => ({}),
			},
			"({availabilityLabel, firstModuleSlug, featuredAvailableModuleCount})",
		);
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
			"astro:content": {},
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

describe("authored course contracts", () => {
	it.each([
		["[course]/[...slug].astro", "CourseSignupForm", "/courses/course/lesson", "lesson"],
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
		expect(signup.attributes.some((attribute: any) => attribute.name === "server:defer")).toBe(true);
		expect(signup.children.some((node: any) => node.attributes?.some((attribute: any) => attribute.name === "slot" && attribute.value === "fallback"))).toBe(true);
		// Render the actual slot markup, not copied fallback prose. This isolates
		// its SSR contract from the island endpoint and provider dependencies.
		const fallback = source.match(/<p slot="fallback"[\s\S]*?<\/p>/)?.[0];
		expect(fallback).toBeDefined();
		const compiled = await transform(`---\nconst doc = { copy: "copy" }; const s = doc;\n---\n${fallback!.replace(' slot="fallback"', '')}`);
		const code = ts.transpileModule(compiled.code, {
			compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
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
		expect(dom.textContent).toContain(`all ${content} content remains available without signing up`);
		expect(dom.querySelector("a")?.getAttribute("href")).toBe(path);
		expect(dom.querySelector("script, form, input")).toBeNull();
	});
	it.each([
		"pages/courses/index.astro",
		"pages/courses/[...slug].astro",
		"pages/courses/[course]/[...slug].astro",
		"components/courses/CourseSignupForm.astro",
		"components/courses/CourseSignupFormCompact.astro",
		"components/courses/CourseModules.astro",
		"components/html/course-jsonld.astro",
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
		for (const directory of readdirSync(contentDir, {
			withFileTypes: true,
		}).filter((item) => item.isDirectory())) {
			for (const file of readdirSync(
				resolve(contentDir, directory.name),
			).filter((name) => /\.mdx?$/.test(name))) {
				const data = entry(resolve(contentDir, directory.name, file));
				if (data.draft !== false) continue;
				for (const resource of data.resources ?? []) {
					if (resource.embedConfig?.container !== "webcontainer") continue;
					demos++;
					expect(registry).toContain(
						`'${data.course}/${resource.embedConfig.src}':`,
					);
				}
			}
		}
		expect(demos).toBe(2);
	});
	it.each([
		["02-prerequisites", "a5uhh9oosvj8ytch0tf84uja"],
		["03-install-docker-compose", "fh6co0t0jsacv1wou1q7iyj7"],
		["04-install-kubernetes", "b7bcg1fl06z4q9529ryalcj2"],
		["05-zitadel-cloud", "wcktaod7wsyzhg7rm0z3p1s3"],
	])("preserves %s media identity in shared lesson metadata", (slug, id) => {
		const file = resolve(contentDir, "complete-guide-zitadel", `${slug}.mdx`);
		const data = entry(file);
		expect(data.video).toEqual({
			id,
			thumbnailUrl: `https://content.rawkode.academy/videos/${id}/thumbnail.jpg`,
		});
		expect(read(file)).not.toMatch(/VideoPlayer|className=|^# /m);
	});
	it("retains teaching sections while removing literal duplicated page introduction", () => {
		const file = resolve(
			contentDir,
			"complete-guide-zitadel/04-install-kubernetes.mdx",
		);
		const source = read(file);
		expect(source.split(entry(file).description)).toHaveLength(2);
		for (const title of [
			"Database Configuration",
			"Core Installation Process",
			"Security and Secrets Management",
			"Day-Two Operations",
			"Outcome",
		])
			expect(source).toContain(title);
	});
	it("only asserts internal tutorial path, dependency and control consistency", () => {
		const source = read(
			resolve(contentDir, "complete-guide-zitadel/07-astro-integration.mdx"),
		);
		expect(source).toContain("http://localhost:4321/api/auth/callback");
		expect(source).toContain("Create `pages/api/auth/callback.ts`");
		expect(source).toContain("bun add arctic @oslojs/jwt");
		expect(source).toContain("bun add -d oidc-client-ts");
		expect(source).toContain(
			'<a href="/api/auth/signin">Login with Zitadel</a>',
		);
		expect(source).not.toContain("<button>");
	});
	it("defers course signup state to requests and preserves the originating page path", async () => {
		for (const [route, component] of [
			["[...slug].astro", "CourseSignupFormCompact"],
			["[course]/[...slug].astro", "CourseSignupForm"],
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
