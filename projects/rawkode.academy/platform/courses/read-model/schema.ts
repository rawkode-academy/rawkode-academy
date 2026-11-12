import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import type { DocNode } from "@rawkodeacademy/rich-text";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import {
	DateTimeResolver,
	JSONObjectResolver,
	JSONResolver,
} from "graphql-scalars";
import * as s from "../data-model/schema";
import { batchLoader, chunk, groupBy } from "./batch";

export interface PothosTypes {
	Context: Record<string, unknown>;
	Scalars: {
		DateTime: { Input: Date; Output: Date };
		JSON: { Input: unknown; Output: unknown };
		RichTextDocument: { Input: DocNode; Output: DocNode };
	};
}

const ids = (values: string[] | null) => (values ?? []).map((id) => ({ id }));

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
	});
	builder.addScalarType("DateTime", DateTimeResolver);
	builder.addScalarType("JSON", JSONResolver);
	// A TipTap/ProseMirror JSON document (packages/rich-text). Every subgraph
	// that serves rich text declares this scalar identically, so the supergraph
	// has a single RichTextDocument type.
	builder.addScalarType("RichTextDocument", JSONObjectResolver, {
		description:
			'A TipTap/ProseMirror JSON document ({"type":"doc","content":[...]}), see @rawkodeacademy/rich-text.',
	});

	const c = s.coursesTable;
	const m = s.courseModulesTable;
	const lp = s.learningPathsTable;

	const courseById = (id: string) =>
		db.select().from(c).where(eq(c.id, id)).get();
	const moduleById = (id: string) =>
		db.select().from(m).where(eq(m.id, id)).get();
	const learningPathById = (id: string) =>
		db.select().from(lp).where(eq(lp.id, id)).get();
	const modulesFor = (courseId: string) =>
		db
			.select()
			.from(m)
			.where(eq(m.courseId, courseId))
			.orderBy(asc(m.sortOrder), asc(m.slug))
			.all();

	// Batched versions for nested fields, so a list of courses or modules
	// costs one query per chunk of parents rather than one per parent.
	const modulesOf = batchLoader(
		async (courseIds: string[]) => {
			const rows = (
				await Promise.all(
					chunk(courseIds).map((ids) =>
						db
							.select()
							.from(m)
							.where(inArray(m.courseId, ids))
							.orderBy(asc(m.sortOrder), asc(m.slug))
							.all(),
					),
				)
			).flat();
			return groupBy(rows, (r) => r.courseId);
		},
		(): s.CourseModule[] => [],
	);
	const courseOf = batchLoader(
		async (courseIds: string[]) => {
			const rows = (
				await Promise.all(
					chunk(courseIds).map((ids) =>
						db.select().from(c).where(inArray(c.id, ids)).all(),
					),
				)
			).flat();
			return new Map(rows.map((r) => [r.id, r]));
		},
		(): s.Course | null => null,
	);

	// Authors and technologies are owned by the people and technologies
	// subgraphs; this service only returns their keys, in frontmatter order.
	const PersonRef = builder.externalRef(
		"Person",
		builder.selection<{ id: string }>("id"),
	);
	PersonRef.implement({ externalFields: (f) => ({ id: f.string() }) });
	const TechnologyRef = builder.externalRef(
		"Technology",
		builder.selection<{ id: string }>("id"),
	);
	TechnologyRef.implement({ externalFields: (f) => ({ id: f.id() }) });

	// Nested types are prefixed with Courses so they cannot clash with other
	// subgraphs in the supergraph.
	const DifficultyEnum = builder.enumType("CoursesDifficulty", {
		values: ["beginner", "intermediate", "advanced"] as const,
	});
	const ResourceTypeEnum = builder.enumType("CoursesResourceType", {
		values: ["url", "file", "embed"] as const,
	});
	const ResourceCategoryEnum = builder.enumType("CoursesResourceCategory", {
		values: ["slides", "code", "documentation", "demos", "other"] as const,
	});
	const EmbedContainerEnum = builder.enumType("CoursesEmbedContainer", {
		values: ["webcontainer", "iframe"] as const,
	});

	const EmbedConfigRef = builder.objectRef<s.EmbedConfig>("CoursesEmbedConfig");
	builder.objectType(EmbedConfigRef, {
		fields: (t) => ({
			container: t.field({
				type: EmbedContainerEnum,
				resolve: (e) => e.container,
			}),
			src: t.exposeString("src"),
			height: t.exposeString("height"),
			width: t.exposeString("width"),
			// WebContainer file system, path -> contents.
			files: t.field({
				type: "JSON",
				nullable: true,
				resolve: (e) => e.files,
			}),
			// The demo id, "<course id>/<demo>": the directory under the
			// website's src/webcontainer-demos that holds the demo's files.
			importLocalDir: t.string({
				nullable: true,
				resolve: (e) => e.import?.localDir,
			}),
			startCommand: t.string({
				nullable: true,
				resolve: (e) => e.startCommand,
			}),
		}),
	});

	const ResourceRef = builder.objectRef<s.Resource>("CoursesResource");
	builder.objectType(ResourceRef, {
		fields: (t) => ({
			id: t.string({ nullable: true, resolve: (r) => r.id }),
			title: t.exposeString("title"),
			description: t.string({ nullable: true, resolve: (r) => r.description }),
			type: t.field({ type: ResourceTypeEnum, resolve: (r) => r.type }),
			url: t.string({ nullable: true, resolve: (r) => r.url }),
			filePath: t.string({ nullable: true, resolve: (r) => r.filePath }),
			embedConfig: t.field({
				type: EmbedConfigRef,
				nullable: true,
				resolve: (r) => r.embedConfig,
			}),
			category: t.field({
				type: ResourceCategoryEnum,
				resolve: (r) => r.category,
			}),
		}),
	});

	const CoverRef = builder.objectRef<{
		url: string;
		alt: string;
		width: number;
		height: number;
	}>("CoursesCover");
	builder.objectType(CoverRef, {
		fields: (t) => ({
			url: t.exposeString("url"),
			alt: t.exposeString("alt"),
			width: t.exposeInt("width"),
			height: t.exposeInt("height"),
		}),
	});

	// Courses and modules store their cover in the same four columns.
	const cover = (r: s.Course | s.CourseModule) =>
		r.coverUrl && r.coverWidth && r.coverHeight
			? {
					url: r.coverUrl,
					alt: r.coverAlt ?? "",
					width: r.coverWidth,
					height: r.coverHeight,
				}
			: null;

	const SignupConfigRef = builder.objectRef<s.SignupConfig>(
		"CoursesSignupConfig",
	);
	builder.objectType(SignupConfigRef, {
		fields: (t) => ({
			audienceId: t.exposeString("audienceId"),
			sponsor: t.string({ nullable: true, resolve: (sc) => sc.sponsor }),
			sponsorAudienceId: t.string({
				nullable: true,
				resolve: (sc) => sc.sponsorAudienceId,
			}),
			allowSponsorContact: t.exposeBoolean("allowSponsorContact"),
		}),
	});

	const ModuleVideoRef = builder.objectRef<s.ModuleVideo>("CoursesModuleVideo");
	builder.objectType(ModuleVideoRef, {
		fields: (t) => ({
			id: t.exposeString("id"),
			thumbnailUrl: t.string({
				nullable: true,
				resolve: (v) => v.thumbnailUrl,
			}),
			youtube: t.string({ nullable: true, resolve: (v) => v.youtube }),
			rawkode: t.string({ nullable: true, resolve: (v) => v.rawkode }),
			poster: t.string({ nullable: true, resolve: (v) => v.poster }),
		}),
	});

	const CourseRef = builder.objectRef<s.Course>("Course");
	const CourseModuleRef = builder.objectRef<s.CourseModule>("CourseModule");
	const LearningPathRef = builder.objectRef<s.LearningPath>("LearningPath");

	builder.objectType(CourseRef, {
		fields: (t) => ({
			id: t.exposeString("id"),
			title: t.exposeString("title"),
			description: t.exposeString("description"),
			cover: t.field({ type: CoverRef, nullable: true, resolve: cover }),
			publishedAt: t.field({ type: "DateTime", resolve: (r) => r.publishedAt }),
			updatedAt: t.field({
				type: "DateTime",
				nullable: true,
				resolve: (r) => r.updatedAt,
			}),
			difficulty: t.field({
				type: DifficultyEnum,
				resolve: (r) => r.difficulty,
			}),
			// Learning objectives (the frontmatter learningPath list), not learning paths.
			learningPath: t.stringList({ resolve: (r) => r.learningPath ?? [] }),
			authors: t.field({ type: [PersonRef], resolve: (r) => ids(r.authors) }),
			technologies: t.field({
				type: [TechnologyRef],
				resolve: (r) => ids(r.technologies),
			}),
			resources: t.field({
				type: [ResourceRef],
				resolve: (r) => r.resources ?? [],
			}),
			signupConfig: t.field({
				type: SignupConfigRef,
				nullable: true,
				resolve: (r) => r.signupConfig,
			}),
			body: t.field({ type: "RichTextDocument", resolve: (r) => r.body }),
			// Every module, drafts included, sorted by order.
			modules: t.field({
				type: [CourseModuleRef],
				resolve: (r, _args, context) => modulesOf(context, r.id),
			}),
		}),
	});

	builder.objectType(CourseModuleRef, {
		fields: (t) => ({
			// "<course id>/<slug>", the website's collection entry id.
			id: t.exposeString("id"),
			courseId: t.exposeString("courseId"),
			course: t.field({
				type: CourseRef,
				nullable: true,
				resolve: (r, _args, context) => courseOf(context, r.courseId),
			}),
			// The public URL segment, from the file name (e.g. "01-introduction").
			slug: t.exposeString("slug"),
			// The frontmatter slug, which the website has never used for URLs.
			frontmatterSlug: t.string({
				nullable: true,
				resolve: (r) => r.frontmatterSlug,
			}),
			title: t.exposeString("title"),
			description: t.exposeString("description"),
			cover: t.field({ type: CoverRef, nullable: true, resolve: cover }),
			section: t.string({ nullable: true, resolve: (r) => r.section }),
			order: t.int({ resolve: (r) => r.sortOrder }),
			video: t.field({
				type: ModuleVideoRef,
				nullable: true,
				resolve: (r) => r.video,
			}),
			// Minutes.
			duration: t.int({ nullable: true, resolve: (r) => r.duration }),
			difficulty: t.field({
				type: DifficultyEnum,
				nullable: true,
				resolve: (r) => r.difficulty,
			}),
			publishedAt: t.field({ type: "DateTime", resolve: (r) => r.publishedAt }),
			updatedAt: t.field({
				type: "DateTime",
				nullable: true,
				resolve: (r) => r.updatedAt,
			}),
			draft: t.exposeBoolean("draft"),
			authors: t.field({ type: [PersonRef], resolve: (r) => ids(r.authors) }),
			resources: t.field({
				type: [ResourceRef],
				resolve: (r) => r.resources ?? [],
			}),
			body: t.field({ type: "RichTextDocument", resolve: (r) => r.body }),
		}),
	});

	builder.objectType(LearningPathRef, {
		fields: (t) => ({
			id: t.exposeString("id"),
			title: t.exposeString("title"),
			description: t.exposeString("description"),
			difficulty: t.field({
				type: DifficultyEnum,
				resolve: (r) => r.difficulty,
			}),
			// Minutes.
			estimatedDuration: t.exposeInt("estimatedDuration"),
			prerequisites: t.stringList({ resolve: (r) => r.prerequisites ?? [] }),
			technologies: t.field({
				type: [TechnologyRef],
				resolve: (r) => ids(r.technologies),
			}),
			publishedAt: t.field({ type: "DateTime", resolve: (r) => r.publishedAt }),
			updatedAt: t.field({
				type: "DateTime",
				nullable: true,
				resolve: (r) => r.updatedAt,
			}),
			authors: t.field({ type: [PersonRef], resolve: (r) => ids(r.authors) }),
			// Numbered "N. [Title](/watch/<slug>)" level-3 headings are the path's
			// video sequence.
			body: t.field({ type: "RichTextDocument", resolve: (r) => r.body }),
		}),
	});

	builder.asEntity(CourseRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: (ref) => courseById(ref.id),
	});
	builder.asEntity(CourseModuleRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: (ref) => moduleById(ref.id),
	});
	builder.asEntity(LearningPathRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: (ref) => learningPathById(ref.id),
	});

	builder.queryType({
		fields: (t) => ({
			courseById: t.field({
				type: CourseRef,
				nullable: true,
				args: { id: t.arg.string({ required: true }) },
				resolve: (_root, args) => courseById(args.id),
			}),
			// Newest first.
			allCourses: t.field({
				type: [CourseRef],
				resolve: () =>
					db.select().from(c).orderBy(desc(c.publishedAt), asc(c.id)).all(),
			}),
			// Every module of a course, drafts included, sorted by order.
			courseModules: t.field({
				type: [CourseModuleRef],
				args: { courseId: t.arg.string({ required: true }) },
				resolve: (_root, args) => modulesFor(args.courseId),
			}),
			courseModule: t.field({
				type: CourseModuleRef,
				nullable: true,
				args: {
					courseId: t.arg.string({ required: true }),
					slug: t.arg.string({ required: true }),
				},
				resolve: (_root, args) =>
					db
						.select()
						.from(m)
						.where(and(eq(m.courseId, args.courseId), eq(m.slug, args.slug)))
						.get(),
			}),
			learningPathById: t.field({
				type: LearningPathRef,
				nullable: true,
				args: { id: t.arg.string({ required: true }) },
				resolve: (_root, args) => learningPathById(args.id),
			}),
			// Newest first.
			allLearningPaths: t.field({
				type: [LearningPathRef],
				resolve: () =>
					db.select().from(lp).orderBy(desc(lp.publishedAt), asc(lp.id)).all(),
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@extends", "@external", "@key"],
	});
};
