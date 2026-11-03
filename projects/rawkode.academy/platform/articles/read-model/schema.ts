import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import { asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import { DateTimeResolver, JSONResolver } from "graphql-scalars";
import * as s from "../data-model/schema";

// An article with its people and technology ids, in order.
type Article = s.Article & { authorIds: string[]; technologyIds: string[] };

export interface PothosTypes {
	Context: Record<string, unknown>;
	Scalars: {
		DateTime: { Input: Date; Output: Date };
		JSON: { Input: unknown; Output: unknown };
	};
}

// D1 caps bound parameters per statement, so id lists are queried in chunks.
const chunk = <T>(items: T[], size = 90) =>
	Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
		items.slice(i * size, i * size + size),
	);

// The website's "Updated" date: frontmatter updatedAt when set, otherwise the
// latest entry in updates (content.config.ts applies the same transform).
const revisedAt = (article: s.Article): Date | null => {
	if (article.revisedAt) return article.revisedAt;
	const dates = article.updates.map((u) => Date.parse(u.date));
	return dates.length ? new Date(Math.max(...dates)) : null;
};

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
	});
	const articles = s.articlesTable;
	const authors = s.articleAuthorsTable;
	const technologies = s.articleTechnologiesTable;

	builder.addScalarType("DateTime", DateTimeResolver);
	builder.addScalarType("JSON", JSONResolver);

	// Loads authors and technologies for a page of articles in two queries.
	const withRelations = async (rows: s.Article[]): Promise<Article[]> => {
		const authorIds = new Map<string, string[]>();
		const technologyIds = new Map<string, string[]>();
		for (const ids of chunk(rows.map((r) => r.id))) {
			const authorRows = await db
				.select()
				.from(authors)
				.where(inArray(authors.articleId, ids))
				.orderBy(asc(authors.articleId), asc(authors.position))
				.all();
			for (const a of authorRows)
				authorIds.set(a.articleId, [
					...(authorIds.get(a.articleId) ?? []),
					a.personId,
				]);
			const technologyRows = await db
				.select()
				.from(technologies)
				.where(inArray(technologies.articleId, ids))
				.orderBy(asc(technologies.articleId), asc(technologies.position))
				.all();
			for (const t of technologyRows)
				technologyIds.set(t.articleId, [
					...(technologyIds.get(t.articleId) ?? []),
					t.technologyId,
				]);
		}
		return rows.map((r) => ({
			...r,
			authorIds: authorIds.get(r.id) ?? [],
			technologyIds: technologyIds.get(r.id) ?? [],
		}));
	};

	// Newest first; the id breaks ties between articles published the same day.
	const newestFirst = [desc(articles.publishedAt), asc(articles.id)];

	const list = (where?: SQL) =>
		db
			.select()
			.from(articles)
			.where(where)
			.orderBy(...newestFirst)
			.all()
			.then(withRelations);

	const byId = async (id: string) =>
		(await list(eq(articles.id, id)))[0] ?? null;

	const byIds = async (ids: string[]) => {
		const rows = (
			await Promise.all(
				chunk(ids).map((page) => list(inArray(articles.id, page))),
			)
		).flat();
		return rows.sort(
			(a, b) =>
				b.publishedAt.getTime() - a.publishedAt.getTime() ||
				a.id.localeCompare(b.id),
		);
	};

	const PersonRef = builder.externalRef(
		"Person",
		builder.selection<{ id: string }>("id"),
	);
	const TechnologyRef = builder.externalRef(
		"Technology",
		builder.selection<{ id: string }>("id"),
	);

	// Nested types are prefixed with Article so they cannot clash with other
	// subgraphs in the supergraph.
	const ArticleTypeEnum = builder.enumType("ArticleType", {
		values: s.ARTICLE_TYPES,
	});
	const ResourceTypeEnum = builder.enumType("ArticleResourceType", {
		values: ["url", "file", "embed"] as const,
	});
	const ResourceCategoryEnum = builder.enumType("ArticleResourceCategory", {
		values: ["slides", "code", "documentation", "demos", "other"] as const,
	});
	const EmbedContainerEnum = builder.enumType("ArticleEmbedContainer", {
		values: ["webcontainer", "iframe"] as const,
	});

	const EmbedConfigRef = builder.objectRef<s.EmbedConfig>("ArticleEmbedConfig");
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
			files: t.field({ type: "JSON", nullable: true, resolve: (e) => e.files }),
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

	const ResourceRef = builder.objectRef<s.Resource>("ArticleResource");
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
	}>("ArticleCover");
	builder.objectType(CoverRef, {
		fields: (t) => ({
			url: t.exposeString("url"),
			alt: t.exposeString("alt"),
			width: t.exposeInt("width"),
			height: t.exposeInt("height"),
		}),
	});

	const OpenGraphRef = builder.objectRef<{
		title: string;
		subtitle: string | null;
	}>("ArticleOpenGraph");
	builder.objectType(OpenGraphRef, {
		fields: (t) => ({
			title: t.exposeString("title"),
			subtitle: t.string({ nullable: true, resolve: (o) => o.subtitle }),
		}),
	});

	const UpdateRef = builder.objectRef<s.ArticleUpdate>("ArticleUpdate");
	builder.objectType(UpdateRef, {
		fields: (t) => ({
			date: t.field({ type: "DateTime", resolve: (u) => new Date(u.date) }),
			description: t.exposeString("description"),
		}),
	});

	const ArticleRef = builder.objectRef<Article>("Article");
	builder.objectType(ArticleRef, {
		fields: (t) => ({
			id: t.exposeString("id"),
			// The id is the public slug; kept separate so URLs read naturally.
			slug: t.exposeString("id"),
			title: t.exposeString("title"),
			subtitle: t.string({ nullable: true, resolve: (r) => r.subtitle }),
			description: t.exposeString("description"),
			body: t.field({
				type: "JSON",
				description: "The article as a TipTap (ProseMirror) JSON document.",
				resolve: (r) => r.body,
			}),
			type: t.field({ type: ArticleTypeEnum, resolve: (r) => r.type }),
			// Opt-in flag for schema.org HowTo JSON-LD.
			howto: t.exposeBoolean("howto"),
			draft: t.exposeBoolean("draft"),
			// The series id from frontmatter. There is no Series entity yet.
			series: t.string({ nullable: true, resolve: (r) => r.series }),
			categories: t.exposeStringList("categories"),
			tags: t.exposeStringList("tags"),
			cover: t.field({
				type: CoverRef,
				nullable: true,
				resolve: (r) =>
					r.coverUrl && r.coverWidth && r.coverHeight
						? {
								url: r.coverUrl,
								alt: r.coverAlt ?? "",
								width: r.coverWidth,
								height: r.coverHeight,
							}
						: null,
			}),
			openGraph: t.field({
				type: OpenGraphRef,
				nullable: true,
				resolve: (r) =>
					r.openGraphTitle
						? { title: r.openGraphTitle, subtitle: r.openGraphSubtitle }
						: null,
			}),
			updates: t.field({ type: [UpdateRef], resolve: (r) => r.updates }),
			resources: t.field({ type: [ResourceRef], resolve: (r) => r.resources }),
			// May be in the future: scheduled articles are returned too.
			publishedAt: t.field({ type: "DateTime", resolve: (r) => r.publishedAt }),
			revisedAt: t.field({
				type: "DateTime",
				nullable: true,
				description:
					"When the article was last revised, for readers: frontmatter updatedAt, otherwise the latest update.",
				resolve: (r) => revisedAt(r),
			}),
			updatedAt: t.field({
				type: "DateTime",
				nullable: true,
				description: "When this record last changed.",
				resolve: (r) => r.updatedAt,
			}),
			authors: t.field({
				type: [PersonRef],
				resolve: (r) => r.authorIds.map((id) => ({ id })),
			}),
			technologies: t.field({
				type: [TechnologyRef],
				resolve: (r) => r.technologyIds.map((id) => ({ id })),
			}),
		}),
	});

	builder.asEntity(ArticleRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: (ref) => byId(ref.id),
	});

	PersonRef.implement({
		externalFields: (f) => ({ id: f.string() }),
		fields: (f) => ({
			authoredArticles: f.field({
				type: [ArticleRef],
				description:
					"Articles this person wrote, newest first, drafts included.",
				resolve: async (person) => {
					const ids = await db
						.select({ id: authors.articleId })
						.from(authors)
						.where(eq(authors.personId, person.id))
						.all();
					return byIds(ids.map((r) => r.id));
				},
			}),
		}),
	});

	TechnologyRef.implement({
		externalFields: (f) => ({ id: f.id() }),
		fields: (f) => ({
			articles: f.field({
				type: [ArticleRef],
				description: "Articles covering this technology, newest first.",
				resolve: async (technology) => {
					const ids = await db
						.select({ id: technologies.articleId })
						.from(technologies)
						.where(eq(technologies.technologyId, String(technology.id)))
						.all();
					return byIds(ids.map((r) => r.id));
				},
			}),
		}),
	});

	builder.queryType({
		fields: (t) => ({
			allArticles: t.field({
				type: [ArticleRef],
				description:
					"Every article, newest first, including drafts and scheduled ones.",
				resolve: () => list(),
			}),
			articleById: t.field({
				type: ArticleRef,
				nullable: true,
				args: { id: t.arg.string({ required: true }) },
				resolve: (_root, args) => byId(args.id),
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@extends", "@external", "@key"],
	});
};
