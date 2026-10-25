import { richTextDocument } from "@rawkodeacademy/content-model/rich-text";
import { tag, tags } from "@rawkodeacademy/content-model/tags";
import {
	defineModels,
	httpUrl,
	requiredText,
	rowSchema,
	slug,
} from "@rawkodeacademy/content-write";
import { z } from "zod";
import {
	courseModulesTable,
	coursesTable,
	learningPathsTable,
} from "../data-model/schema";

// The website's courseModules entry id (website/src/lib/live-content/mappers.ts,
// courseModuleId). Module rows store it as their id.
export const courseModuleId = (courseId: string, moduleSlug: string): string =>
	`${courseId}/${moduleSlug}`;

const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

// Not blank, but kept as written: stored descriptions end in the newline of
// their YAML block scalars.
const nonBlank = () =>
	z.string().refine((value) => value.trim().length > 0, "Required");
const optionalText = () => z.string().trim().min(1).nullable().optional();
const ids = () => z.array(slug());
const strings = () => z.array(requiredText());
const coverSize = () => z.number().int().positive().nullable().optional();

// The website's resourceSchema, with its defaults (category "other", embed
// height "600px" and width "100%").
const embedConfig = z
	.object({
		container: z.enum(["webcontainer", "iframe"]),
		src: requiredText(),
		height: requiredText().default("600px"),
		width: requiredText().default("100%"),
		files: z.record(z.string()).optional(),
		import: z.object({ localDir: requiredText() }).strict().optional(),
		startCommand: requiredText().optional(),
	})
	.strict();

// What each resource type points at.
type ResourceTarget = {
	type: "url" | "file" | "embed";
	url?: string;
	filePath?: string;
	embedConfig?: { import?: { localDir: string } };
};

const resource = z
	.object({
		id: requiredText().optional(),
		title: requiredText(),
		description: z.string().optional(),
		type: z.enum(["url", "file", "embed"]),
		url: httpUrl().optional(),
		filePath: requiredText().optional(),
		embedConfig: embedConfig.optional(),
		category: z
			.enum(["slides", "code", "documentation", "demos", "other"])
			.default("other"),
	})
	.strict()
	.superRefine((value, ctx) => {
		const r = value as ResourceTarget;
		const needs = {
			url: "url",
			file: "filePath",
			embed: "embedConfig",
		} as const;
		const prop = needs[r.type];
		if (!r[prop]) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: [prop],
				message: `A ${r.type} resource needs ${prop}`,
			});
		}
	});
const resources = () => z.array(resource).nullable().optional();

// WebContainer demos live in the website's src/webcontainer-demos/<course id>/.
const demosBelongTo = (
	courseId: unknown,
	list: unknown,
	ctx: z.RefinementCtx,
) => {
	((list as ResourceTarget[] | null | undefined) ?? []).forEach((r, index) => {
		const localDir = r.embedConfig?.import?.localDir;
		if (localDir && !localDir.startsWith(`${String(courseId)}/`)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["resources", index, "embedConfig", "import", "localDir"],
				message: `Use a demo of this course: "${String(courseId)}/<demo>"`,
			});
		}
	});
};

const course = rowSchema(coursesTable, {
	id: slug(),
	title: requiredText(),
	description: nonBlank(),
	coverUrl: httpUrl().nullable().optional(),
	coverAlt: optionalText(),
	coverWidth: coverSize(),
	coverHeight: coverSize(),
	difficulty: z.enum(DIFFICULTIES),
	// Learning objectives, not learning path ids.
	learningPath: strings(),
	authors: ids(),
	technologies: ids(),
	resources: resources(),
	signupConfig: z
		.object({
			audienceId: requiredText(),
			sponsor: requiredText().optional(),
			sponsorAudienceId: requiredText().optional(),
			allowSponsorContact: z.boolean().default(false),
		})
		.strict()
		.nullable()
		.optional(),
	body: richTextDocument(),
}).superRefine((row, ctx) => demosBelongTo(row.id, row.resources, ctx));

const courseModule = rowSchema(courseModulesTable, {
	id: requiredText(),
	courseId: slug(),
	// The public URL segment (the old content file name).
	slug: slug(),
	frontmatterSlug: optionalText(),
	title: requiredText(),
	description: nonBlank(),
	coverUrl: httpUrl().nullable().optional(),
	coverAlt: optionalText(),
	coverWidth: coverSize(),
	coverHeight: coverSize(),
	section: optionalText(),
	sortOrder: z.number().int().nonnegative(),
	video: z
		.object({
			id: requiredText(),
			thumbnailUrl: httpUrl().optional(),
			youtube: requiredText().optional(),
			rawkode: requiredText().optional(),
			poster: requiredText().optional(),
		})
		.strict()
		.nullable()
		.optional(),
	duration: z.number().int().positive().nullable().optional(),
	difficulty: z.enum(DIFFICULTIES).nullable().optional(),
	authors: ids(),
	resources: resources(),
	body: richTextDocument(),
}).superRefine((row, ctx) => {
	// The id is the website's entry id, so courseId and slug cannot change
	// once a module exists (ids are immutable).
	const expected = courseModuleId(String(row.courseId), String(row.slug));
	if (row.id !== expected) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ["id"],
			message: `A module id is "<course id>/<slug>": "${expected}"`,
		});
	}
	demosBelongTo(row.courseId, row.resources, ctx);
});

const learningPath = rowSchema(learningPathsTable, {
	id: slug(),
	title: requiredText(),
	description: nonBlank(),
	difficulty: z.enum(DIFFICULTIES),
	// Minutes.
	estimatedDuration: z.number().int().nonnegative(),
	prerequisites: strings(),
	technologies: ids(),
	authors: ids(),
	body: richTextDocument(),
});

const list = (value: unknown) => value as string[] | null | undefined;

export const models = defineModels("courses", [
	{
		kind: "entity",
		name: "course",
		table: coursesTable,
		key: "id",
		schema: course,
		// Module pages carry their course's tag, so it covers them too.
		tags: (row) => [
			tag("courses", row.id),
			...tags("people", list(row.authors)),
			...tags("technologies", list(row.technologies)),
		],
		search: ["id", "title"],
		orderBy: { column: "publishedAt", direction: "desc" },
	},
	{
		kind: "entity",
		name: "course-module",
		table: courseModulesTable,
		key: "id",
		schema: courseModule,
		// The course page lists its modules.
		tags: (row) => [
			tag(
				"courseModules",
				courseModuleId(String(row.courseId), String(row.slug)),
			),
			tag("courses", row.courseId),
			...tags("people", list(row.authors)),
		],
		search: ["id", "title"],
		// Course order; filter by courseId to list one course.
		orderBy: { column: "sortOrder", direction: "asc" },
	},
	{
		kind: "entity",
		name: "learning-path",
		table: learningPathsTable,
		key: "id",
		schema: learningPath,
		tags: (row) => [
			tag("learningPaths", row.id),
			...tags("people", list(row.authors)),
			...tags("technologies", list(row.technologies)),
		],
		search: ["id", "title"],
		orderBy: { column: "publishedAt", direction: "desc" },
	},
]);
