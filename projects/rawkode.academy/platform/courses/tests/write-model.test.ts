import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import {
	ContentStore,
	type ContentWriteEnv,
} from "@rawkodeacademy/content-write";
import { models } from "../write-model/models";
import { loadFixtures, migratedD1 } from "./d1";

const agent = { id: "course-skill", kind: "agent" as const };
const doc = {
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [{ type: "text", text: "Learn Bun by building." }],
		},
	],
};

const newCourse = {
	id: "bun-from-scratch",
	title: "Bun from Scratch",
	description: "Build and ship a Bun service.\n",
	publishedAt: "2026-11-01T00:00:00.000Z",
	difficulty: "beginner",
	learningPath: ["Install Bun", "Write a server"],
	authors: ["rawkode"],
	technologies: ["bun"],
	resources: [
		{
			title: "Bun docs",
			type: "url",
			url: "https://bun.sh/docs",
			category: "documentation",
		},
		{
			title: "Hello demo",
			type: "embed",
			embedConfig: {
				container: "webcontainer",
				src: "hello",
				import: { localDir: "bun-from-scratch/hello" },
			},
		},
	],
	signupConfig: { audienceId: "bun-from-scratch" },
	body: doc,
};

const newModule = {
	id: "bun-from-scratch/01-introduction",
	courseId: "bun-from-scratch",
	slug: "01-introduction",
	title: "Introduction",
	description: "Why Bun?",
	section: "Getting Started",
	sortOrder: 1,
	video: {
		id: "abc123",
		thumbnailUrl: "https://content.rawkode.academy/videos/abc123/thumbnail.jpg",
	},
	publishedAt: "2026-11-01T00:00:00.000Z",
	draft: false,
	authors: ["rawkode", "salaboy"],
	body: doc,
};

type ChangeEvent = Parameters<
	NonNullable<ContentWriteEnv["CONTENT_CHANGES"]>["send"]
>[0];

let db: Awaited<ReturnType<typeof migratedD1>>;
let store: ContentStore;
const events: ChangeEvent[] = [];

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	await loadFixtures(db.DB);
	const queue = {
		send: async (event: ChangeEvent) => {
			events.push(event);
		},
	} as unknown as ContentWriteEnv["CONTENT_CHANGES"];
	store = new ContentStore(models, { DB: db.DB, CONTENT_CHANGES: queue });
});
afterAll(() => db.dispose());

describe("courses write model", () => {
	for (const model of ["course", "course-module", "learning-path"]) {
		it(`accepts every stored ${model} as it is`, async () => {
			const page = await store.list(model, { limit: 200 });
			if (!page.ok) throw new Error(page.error.message);
			expect(page.value.rows.length).toBeGreaterThan(0);
			for (const row of page.value.rows) {
				const result = await store.update(
					model,
					String(row.id),
					{},
					{ ifVersion: 0 },
					agent,
				);
				if (!result.ok) {
					throw new Error(`${row.id}: ${JSON.stringify(result.error)}`);
				}
				const { updatedAt: _, ...stored } = row;
				const { updatedAt: __, ...written } = result.value.value;
				expect(written).toEqual(stored);
			}
		});
	}

	it("creates a course with the website's defaults", async () => {
		const created = await store.create("course", newCourse, agent);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		const course = created.value.value;
		expect(course.publishedAt).toEqual(new Date("2026-11-01T00:00:00.000Z"));
		expect(course.resources).toEqual([
			newCourse.resources[0],
			{
				title: "Hello demo",
				type: "embed",
				category: "other",
				embedConfig: {
					container: "webcontainer",
					src: "hello",
					height: "600px",
					width: "100%",
					import: { localDir: "bun-from-scratch/hello" },
				},
			},
		]);
		expect(course.signupConfig).toEqual({
			audienceId: "bun-from-scratch",
			allowSponsorContact: false,
		});
		expect(events.at(-1)?.tags.sort()).toEqual(
			["courses:bun-from-scratch", "people:rawkode", "technologies:bun"].sort(),
		);
	});

	it("creates a module tagged with the website's module id", async () => {
		const created = await store.create("course-module", newModule, agent);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		expect(created.value.value.frontmatterSlug).toBeNull();
		// website/src/lib/live-content/mappers.ts: courseModuleId(course, slug)
		// and relatedTags("courseModules") (its authors and its course).
		expect(events.at(-1)?.tags.sort()).toEqual(
			[
				"courseModules:bun-from-scratch/01-introduction",
				"courses:bun-from-scratch",
				"people:rawkode",
				"people:salaboy",
			].sort(),
		);
	});

	it("tags stored modules by course and file slug, not the frontmatter slug", async () => {
		const id = "complete-guide-zitadel/08-remix-integration";
		const current = await store.get("course-module", id);
		if (!current.ok) throw new Error(current.error.message);
		const result = await store.update(
			"course-module",
			id,
			{ draft: false },
			{ ifVersion: current.value.version },
			agent,
		);
		if (!result.ok) throw new Error(JSON.stringify(result.error));
		expect(events.at(-1)?.tags).toContain(
			"courseModules:complete-guide-zitadel/08-remix-integration",
		);
		expect(events.at(-1)?.tags).toContain("courses:complete-guide-zitadel");
	});

	it("rejects a course the website cannot render", async () => {
		const result = await store.create(
			"course",
			{
				...newCourse,
				id: "Not A Slug",
				difficulty: "expert",
				authors: ["David Flanagan"],
				resources: [
					{ title: "Docs", type: "url", url: "not a url" },
					{ title: "Slides", type: "file", category: "slides" },
					{
						title: "Demo",
						type: "embed",
						embedConfig: {
							container: "webcontainer",
							src: "demo",
							import: { localDir: "another-course/demo" },
						},
					},
				],
				signupConfig: { sponsor: "Acme" },
				body: { type: "doc", content: [{ type: "marquee" }] },
			},
			agent,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.issues?.map((i) => i.path).sort()).toEqual(
			[
				"authors.0",
				"body",
				"difficulty",
				"id",
				"resources.0.url",
				"resources.1.filePath",
				"signupConfig.audienceId",
			].sort(),
		);
	});

	it("rejects a demo from another course once the course id is valid", async () => {
		const result = await store.create(
			"course",
			{
				...newCourse,
				id: "other-course",
				resources: [newCourse.resources[1]],
			},
			agent,
		);
		expect(!result.ok && result.error.issues?.map((i) => i.path)).toEqual([
			"resources.0.embedConfig.import.localDir",
		]);
	});

	it("rejects a module whose id is not <course id>/<slug>", async () => {
		const result = await store.create(
			"course-module",
			{
				...newModule,
				id: "bun-from-scratch/introduction",
				sortOrder: -1,
				difficulty: "expert",
				video: { youtube: "abc" },
				description: "  ",
			},
			agent,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.issues?.map((i) => i.path).sort()).toEqual(
			["description", "difficulty", "sortOrder", "video.id"].sort(),
		);

		const wrongId = await store.create(
			"course-module",
			{ ...newModule, id: "bun-from-scratch/introduction" },
			agent,
		);
		expect(!wrongId.ok && wrongId.error.issues?.map((i) => i.path)).toEqual([
			"id",
		]);
	});

	it("rejects a learning path with bad references", async () => {
		const result = await store.create(
			"learning-path",
			{
				id: "bun-path",
				title: "Bun path",
				description: "Learn Bun.",
				difficulty: "beginner",
				estimatedDuration: 1.5,
				prerequisites: [""],
				technologies: ["Bun!"],
				publishedAt: "2026-11-01",
				authors: ["rawkode"],
				body: doc,
			},
			agent,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.issues?.map((i) => i.path).sort()).toEqual(
			["estimatedDuration", "prerequisites.0", "technologies.0"].sort(),
		);
	});
});

describe("foreign keys", () => {
	it("reports a module for a course that does not exist as a validation error", async () => {
		const orphan = {
			...newModule,
			id: "no-such-course/intro",
			courseId: "no-such-course",
		};
		const result = await store.create("course-module", orphan, agent);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("validation");
	});
});
