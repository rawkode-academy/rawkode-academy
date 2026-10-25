import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { printSubgraphSchema } from "@apollo/subgraph";
import type { D1Database } from "@cloudflare/workers-types";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { loadFixtures, migratedD1 } from "./d1";

// Rich-text documents, walked depth first.
type DocJson = {
	type: string;
	attrs?: Record<string, any>;
	text?: string;
	content?: DocJson[];
};
const walk = (node: DocJson): DocJson[] => [
	node,
	...(node.content ?? []).flatMap(walk),
];
const plain = (node: DocJson): string =>
	node.text ?? (node.content ?? []).map(plain).join("");

let db: Awaited<ReturnType<typeof migratedD1>>;
const query = async (source: string) => {
	const result = await graphql({
		schema: getSchema({ DB: db.DB }),
		source,
		contextValue: {},
	});
	if (result.errors) throw result.errors[0];
	// Round-trip through JSON like the wire, so DateTime values are ISO strings.
	return JSON.parse(JSON.stringify(result.data)) as Record<string, any>;
};

// Runs a query and counts the statements it sends to D1.
const countStatements = async (source: string) => {
	let statements = 0;
	const DB = {
		prepare: (sql: string) => {
			statements++;
			return db.DB.prepare(sql);
		},
		batch: (batch: Parameters<D1Database["batch"]>[0]) => db.DB.batch(batch),
	} as unknown as D1Database;
	const result = await graphql({
		schema: getSchema({ DB }),
		source,
		contextValue: {},
	});
	if (result.errors) throw result.errors[0];
	return { data: result.data as Record<string, any>, statements };
};

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	await loadFixtures(db.DB);
});
afterAll(() => db.dispose());

describe("courses read model", () => {
	it("lists courses newest first", async () => {
		const { allCourses } = await query("{ allCourses { id } }");
		expect(allCourses.map((c: { id: string }) => c.id)).toEqual([
			"teleport-for-kubernetes",
			"graphql-federation-wundergraph-cosmo",
			"complete-guide-zitadel",
		]);
	});

	it("serves every course field the website renders", async () => {
		const { courseById } =
			await query(`{ courseById(id: "teleport-for-kubernetes") {
			id title description publishedAt updatedAt difficulty learningPath body
			cover { url alt width height }
			authors { id } technologies { id }
			resources { title description type url category embedConfig { src } }
			signupConfig { audienceId sponsor sponsorAudienceId allowSponsorContact } } }`);
		expect(courseById).toMatchObject({
			id: "teleport-for-kubernetes",
			title: "Teleport for Kubernetes",
			publishedAt: "2026-03-23T00:00:00.000Z",
			difficulty: "intermediate",
			cover: {
				url: "https://content.rawkode.academy/courses/teleport-for-kubernetes/teleport-for-kubernetes.png",
				alt: "Teleport for Kubernetes Course Cover",
				width: 1376,
				height: 768,
			},
			authors: [{ id: "rawkode" }],
			technologies: [{ id: "teleport" }, { id: "kubernetes" }],
			signupConfig: {
				audienceId: "teleport-for-kubernetes",
				sponsor: "Teleport",
				sponsorAudienceId: "teleport",
				allowSponsorContact: true,
			},
		});
		expect(courseById.learningPath).toHaveLength(5);
		expect(courseById.resources[0]).toEqual({
			title: "Teleport Documentation",
			description: "Official Teleport documentation",
			type: "url",
			url: "https://goteleport.com/docs/",
			category: "documentation",
			embedConfig: null,
		});
		expect(courseById.body.content[0]).toEqual({
			type: "heading",
			attrs: { level: 2, id: "about-this-course" },
			content: [{ type: "text", text: "About this Course" }],
		});
		expect(new Date(courseById.updatedAt).getTime()).toBeGreaterThan(0);
	});

	it("returns null for an unknown course", async () => {
		const { courseById } = await query(`{ courseById(id: "nope") { id } }`);
		expect(courseById).toBeNull();
	});

	it("lists a course's modules by order, drafts included", async () => {
		const { courseModules, courseById } = await query(`{
			courseModules(courseId: "complete-guide-zitadel") { id slug order draft section }
			courseById(id: "complete-guide-zitadel") { modules { id } } }`);
		expect(courseModules.map((m: { slug: string }) => m.slug)).toEqual([
			"01-introduction",
			"08-remix-integration",
			"09-authentication-methods",
			"branding-customization",
			"enterprise-sso",
		]);
		expect(courseModules[1]).toMatchObject({ order: 8, draft: true });
		expect(courseModules[3]).toMatchObject({
			order: 99,
			section: "Customization",
		});
		expect(courseById.modules).toEqual(
			courseModules.map((m: { id: string }) => ({ id: m.id })),
		);
	});

	it("loads modules and their courses for every course in one query each", async () => {
		const { data, statements } = await countStatements(
			"{ allCourses { id modules { id course { id } } } }",
		);
		const withModules = data.allCourses.filter(
			(course: { modules: unknown[] }) => course.modules.length,
		);
		expect(
			withModules.map((course: { id: string }) => course.id).sort(),
		).toEqual(["complete-guide-zitadel", "teleport-for-kubernetes"]);
		for (const course of data.allCourses) {
			const { courseModules } = await query(
				`{ courseModules(courseId: "${course.id}") { id } }`,
			);
			expect(course.modules.map((m: { id: string }) => ({ id: m.id }))).toEqual(
				courseModules,
			);
			for (const module of course.modules)
				expect(module.course).toEqual({ id: course.id });
		}
		// Courses, then every module, then every module's course.
		expect(statements).toBe(3);
	});

	it("finds a module by course and file-name slug, not the frontmatter slug", async () => {
		const { byFile, byFrontmatter } = await query(`{
			byFile: courseModule(courseId: "complete-guide-zitadel", slug: "01-introduction") {
				id courseId slug frontmatterSlug title section order draft publishedAt
				cover { url } video { id thumbnailUrl } authors { id } course { id }
				resources { type category embedConfig { container src height width importLocalDir startCommand files } } }
			byFrontmatter: courseModule(courseId: "complete-guide-zitadel", slug: "introduction") { id } }`);
		expect(byFrontmatter).toBeNull();
		expect(byFile).toMatchObject({
			id: "complete-guide-zitadel/01-introduction",
			courseId: "complete-guide-zitadel",
			slug: "01-introduction",
			frontmatterSlug: "introduction",
			order: 1,
			draft: false,
			publishedAt: "2025-07-02T00:00:00.000Z",
			video: {
				id: "hgg3yhgkk4jn9l7ryjw9ebs8",
				thumbnailUrl:
					"https://content.rawkode.academy/videos/hgg3yhgkk4jn9l7ryjw9ebs8/thumbnail.jpg",
			},
			authors: [{ id: "rawkode" }],
			course: { id: "complete-guide-zitadel" },
			cover: null,
		});
		expect(byFile.resources[3]).toEqual({
			type: "embed",
			category: "code",
			embedConfig: {
				container: "webcontainer",
				src: "oauth-pkce-app",
				height: "800px",
				width: "100%",
				importLocalDir: "complete-guide-zitadel/oauth-pkce-app",
				startCommand: "bun run dev",
				files: null,
			},
		});
	});

	it("stores MDX asides as aside nodes", async () => {
		const { courseModule } = await query(
			`{ courseModule(courseId: "complete-guide-zitadel", slug: "09-authentication-methods") { body } }`,
		);
		const nodes = walk(courseModule.body);
		const asides = nodes.filter((node) => node.type === "aside");
		expect(asides.map((node) => node.attrs?.variant)).toEqual([
			"warning",
			"info",
			"tip",
		]);
		expect(plain(asides[0])).toStartWith(
			"Important: Username and password authentication is NOT enabled",
		);
		expect(
			nodes.some((node) => /<\/?Aside|import Aside/.test(node.text ?? "")),
		).toBe(false);
	});

	it("serves a module cover in the course cover's shape", async () => {
		await db.DB.prepare(
			"UPDATE course_modules SET cover_url = 'https://content.rawkode.academy/courses/complete-guide-zitadel/enterprise-sso/cover.png', cover_alt = 'SSO', cover_width = 1280, cover_height = 720 WHERE id = 'complete-guide-zitadel/enterprise-sso'",
		).run();
		const { courseModule } = await query(
			`{ courseModule(courseId: "complete-guide-zitadel", slug: "enterprise-sso") { cover { url alt width height } } }`,
		);
		expect(courseModule.cover).toEqual({
			url: "https://content.rawkode.academy/courses/complete-guide-zitadel/enterprise-sso/cover.png",
			alt: "SSO",
			width: 1280,
			height: 720,
		});
		await db.DB.prepare(
			"UPDATE course_modules SET cover_url = NULL, cover_alt = NULL, cover_width = NULL, cover_height = NULL WHERE id = 'complete-guide-zitadel/enterprise-sso'",
		).run();
	});

	it("serves learning paths", async () => {
		const { allLearningPaths, learningPathById } = await query(`{
			allLearningPaths { id }
			learningPathById(id: "gitops-landscape") {
				id title difficulty estimatedDuration prerequisites publishedAt updatedAt body
				technologies { id } authors { id } } }`);
		expect(allLearningPaths.map((p: { id: string }) => p.id)).toEqual([
			"gitops-landscape",
			"klustered-advanced-cluster-triage",
		]);
		expect(learningPathById).toMatchObject({
			id: "gitops-landscape",
			title: "GitOps Landscape",
			difficulty: "advanced",
			estimatedDuration: 432,
			publishedAt: "2025-10-01T00:00:00.000Z",
			authors: [{ id: "rawkode" }],
		});
		expect(learningPathById.prerequisites).toHaveLength(5);
		expect(
			learningPathById.technologies.map((t: { id: string }) => t.id),
		).toEqual([
			"kubernetes",
			"timoni",
			"cue",
			"kluctl",
			"fluxcd",
			"gimlet",
			"sveltos",
		]);
		// The video sequence: numbered level-3 headings linking to /watch/<slug>.
		const first = learningPathById.body.content.find(
			(node: DocJson) => node.type === "heading" && node.attrs?.level === 3,
		);
		expect(plain(first)).toBe("1. Timoni: CUE-powered Package Management");
		expect(first.content[1].marks[0].attrs.href).toBe(
			"/watch/timoni-cue-powered-package-management-for-kubernetes",
		);
	});

	it("resolves Course, CourseModule and LearningPath entities for the gateway", async () => {
		const { _entities } = await query(`{ _entities(representations: [
			{ __typename: "Course", id: "complete-guide-zitadel" },
			{ __typename: "CourseModule", id: "teleport-for-kubernetes/01-introduction" },
			{ __typename: "LearningPath", id: "klustered-advanced-cluster-triage" }
		]) { ... on Course { title } ... on CourseModule { slug } ... on LearningPath { estimatedDuration } } }`);
		expect(_entities).toEqual([
			{ title: "Zitadel Tutorial: Self-Host Auth with Docker & K8s (2026)" },
			{ slug: "01-introduction" },
			{ estimatedDuration: 447 },
		]);
	});

	it("prefixes nested types so they cannot clash in the supergraph", () => {
		const sdl = printSubgraphSchema(
			getSchema({} as Parameters<typeof getSchema>[0]),
		);
		const types = [...sdl.matchAll(/^(?:type|enum) (\w+)/gm)].map((m) => m[1]);
		const owned = [
			"Course",
			"CourseModule",
			"LearningPath",
			"Query",
			"Person",
			"Technology",
		];
		expect(sdl).toContain("scalar RichTextDocument");
		expect(
			types.filter((t) => !owned.includes(t) && !t.startsWith("Courses")),
		).toEqual([]);
	});
});
