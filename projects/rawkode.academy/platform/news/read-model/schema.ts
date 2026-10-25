import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import type { DocNode } from "@rawkodeacademy/rich-text";
import { asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import { DateTimeResolver, JSONObjectResolver } from "graphql-scalars";
import * as s from "../data-model/schema";
import { batchLoader, chunk, groupBy } from "./batch";

// A story with its people and technology ids, in order.
type NewsStory = s.NewsStory & { authorIds: string[]; technologyIds: string[] };

export interface PothosTypes {
	Context: Record<string, unknown>;
	Scalars: {
		DateTime: { Input: Date; Output: Date };
		RichTextDocument: { Input: DocNode; Output: DocNode };
	};
}

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
	});
	const stories = s.newsStoriesTable;
	const authors = s.newsAuthorsTable;
	const technologies = s.newsTechnologiesTable;

	builder.addScalarType("DateTime", DateTimeResolver);
	// A TipTap/ProseMirror JSON document (packages/rich-text). Every subgraph
	// that serves rich text declares this scalar identically, so the supergraph
	// has a single RichTextDocument type.
	builder.addScalarType("RichTextDocument", JSONObjectResolver, {
		description:
			'A TipTap/ProseMirror JSON document ({"type":"doc","content":[...]}), see @rawkodeacademy/rich-text.',
	});

	// Loads authors and technologies for a page of stories in two queries.
	const withRelations = async (rows: s.NewsStory[]): Promise<NewsStory[]> => {
		const authorIds = new Map<string, string[]>();
		const technologyIds = new Map<string, string[]>();
		for (const ids of chunk(rows.map((r) => r.id))) {
			const authorRows = await db
				.select()
				.from(authors)
				.where(inArray(authors.storyId, ids))
				.orderBy(asc(authors.storyId), asc(authors.position))
				.all();
			for (const a of authorRows)
				authorIds.set(a.storyId, [
					...(authorIds.get(a.storyId) ?? []),
					a.personId,
				]);
			const technologyRows = await db
				.select()
				.from(technologies)
				.where(inArray(technologies.storyId, ids))
				.orderBy(asc(technologies.storyId), asc(technologies.position))
				.all();
			for (const t of technologyRows)
				technologyIds.set(t.storyId, [
					...(technologyIds.get(t.storyId) ?? []),
					t.technologyId,
				]);
		}
		return rows.map((r) => ({
			...r,
			authorIds: authorIds.get(r.id) ?? [],
			technologyIds: technologyIds.get(r.id) ?? [],
		}));
	};

	// Newest first; the id breaks ties between stories published the same day.
	const newestFirst = [desc(stories.publishedAt), asc(stories.id)];

	const list = (where?: SQL) =>
		db
			.select()
			.from(stories)
			.where(where)
			.orderBy(...newestFirst)
			.all()
			.then(withRelations);

	const byId = async (id: string) =>
		(await list(eq(stories.id, id)))[0] ?? null;

	const byIds = async (ids: string[]) => {
		const rows = (
			await Promise.all(
				chunk(ids).map((page) => list(inArray(stories.id, page))),
			)
		).flat();
		return rows.sort(
			(a, b) =>
				b.publishedAt.getTime() - a.publishedAt.getTime() ||
				a.id.localeCompare(b.id),
		);
	};

	// Splits (owner, story) links into each owner's stories, newest first,
	// loading every linked story once.
	const storiesPer = async (links: { owner: string; storyId: string }[]) => {
		const rows = await byIds([...new Set(links.map((l) => l.storyId))]);
		return new Map(
			[...groupBy(links, (l) => l.owner)].map(([owner, owned]) => {
				const ids = new Set(owned.map((l) => l.storyId));
				return [owner, rows.filter((r) => ids.has(r.id))];
			}),
		);
	};

	const storiesByAuthor = batchLoader(
		async (personIds: string[]) =>
			storiesPer(
				(
					await Promise.all(
						chunk(personIds).map((ids) =>
							db
								.select({ owner: authors.personId, storyId: authors.storyId })
								.from(authors)
								.where(inArray(authors.personId, ids))
								.all(),
						),
					)
				).flat(),
			),
		(): NewsStory[] => [],
	);

	const storiesByTechnology = batchLoader(
		async (technologyIds: string[]) =>
			storiesPer(
				(
					await Promise.all(
						chunk(technologyIds).map((ids) =>
							db
								.select({
									owner: technologies.technologyId,
									storyId: technologies.storyId,
								})
								.from(technologies)
								.where(inArray(technologies.technologyId, ids))
								.all(),
						),
					)
				).flat(),
			),
		(): NewsStory[] => [],
	);

	const PersonRef = builder.externalRef(
		"Person",
		builder.selection<{ id: string }>("id"),
	);
	const TechnologyRef = builder.externalRef(
		"Technology",
		builder.selection<{ id: string }>("id"),
	);

	const NewsStoryRef = builder.objectRef<NewsStory>("NewsStory");
	builder.objectType(NewsStoryRef, {
		fields: (t) => ({
			id: t.exposeString("id"),
			// The id is the public slug; kept separate so URLs read naturally.
			slug: t.exposeString("id"),
			title: t.exposeString("title"),
			description: t.exposeString("description"),
			body: t.field({ type: "RichTextDocument", resolve: (r) => r.body }),
			// May be in the future: scheduled stories are returned too.
			publishedAt: t.field({ type: "DateTime", resolve: (r) => r.publishedAt }),
			updatedAt: t.field({
				type: "DateTime",
				nullable: true,
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

	builder.asEntity(NewsStoryRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: (ref) => byId(ref.id),
	});

	PersonRef.implement({
		externalFields: (f) => ({ id: f.string() }),
		fields: (f) => ({
			newsStories: f.field({
				type: [NewsStoryRef],
				resolve: (person, _args, context) =>
					storiesByAuthor(context, person.id),
			}),
		}),
	});

	TechnologyRef.implement({
		externalFields: (f) => ({ id: f.id() }),
		fields: (f) => ({
			newsStories: f.field({
				type: [NewsStoryRef],
				resolve: (technology, _args, context) =>
					storiesByTechnology(context, String(technology.id)),
			}),
		}),
	});

	builder.queryType({
		fields: (t) => ({
			allNewsStories: t.field({
				type: [NewsStoryRef],
				description: "Every story, newest first, including scheduled ones.",
				resolve: () => list(),
			}),
			newsStoryById: t.field({
				type: NewsStoryRef,
				nullable: true,
				args: { id: t.arg.string({ required: true }) },
				resolve: (_root, args) => byId(args.id),
			}),
			newsStoryBySlug: t.field({
				type: NewsStoryRef,
				nullable: true,
				args: { slug: t.arg.string({ required: true }) },
				resolve: (_root, args) => byId(args.slug),
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@extends", "@external", "@key"],
	});
};
