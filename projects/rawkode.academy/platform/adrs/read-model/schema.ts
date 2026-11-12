import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import type { DocNode } from "@rawkodeacademy/rich-text";
import { asc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import { DateTimeResolver, JSONObjectResolver } from "graphql-scalars";
import * as s from "../data-model/schema";
import { batchLoader, chunk, groupBy } from "./batch";

type Adr = s.Adr;

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
	const authors = s.adrAuthorsTable;

	builder.addScalarType("DateTime", DateTimeResolver);
	// A TipTap/ProseMirror JSON document (packages/rich-text). Every subgraph
	// that serves rich text declares this scalar identically, so the supergraph
	// has a single RichTextDocument type.
	builder.addScalarType("RichTextDocument", JSONObjectResolver, {
		description:
			'A TipTap/ProseMirror JSON document ({"type":"doc","content":[...]}), see @rawkodeacademy/rich-text.',
	});

	const byId = (id: string) =>
		db.select().from(s.adrsTable).where(eq(s.adrsTable.id, id)).get();

	// Byline for a whole list of ADRs in one query per chunk of ids.
	const authorsOf = batchLoader(
		async (adrIds: string[]) => {
			const rows = (
				await Promise.all(
					chunk(adrIds).map((ids) =>
						db
							.select({ adrId: authors.adrId, id: authors.personId })
							.from(authors)
							.where(inArray(authors.adrId, ids))
							.orderBy(asc(authors.adrId), asc(authors.position))
							.all(),
					),
				)
			).flat();
			return new Map(
				[...groupBy(rows, (r) => r.adrId)].map(([adrId, people]) => [
					adrId,
					people.map(({ id }) => ({ id })),
				]),
			);
		},
		(): { id: string }[] => [],
	);

	// The ADRs each of a batch of people wrote, sorted by id.
	const adrsBy = batchLoader(
		async (personIds: string[]) => {
			const rows = (
				await Promise.all(
					chunk(personIds).map((ids) =>
						db
							.select({ personId: authors.personId, adr: s.adrsTable })
							.from(authors)
							.innerJoin(s.adrsTable, eq(s.adrsTable.id, authors.adrId))
							.where(inArray(authors.personId, ids))
							.orderBy(asc(s.adrsTable.id))
							.all(),
					),
				)
			).flat();
			return new Map(
				[...groupBy(rows, (r) => r.personId)].map(([personId, adrs]) => [
					personId,
					adrs.map(({ adr }) => adr),
				]),
			);
		},
		(): Adr[] => [],
	);

	const PersonRef = builder.externalRef(
		"Person",
		builder.selection<{ id: string }>("id"),
	);

	const AdrRef = builder.objectRef<Adr>("Adr");
	builder.objectType(AdrRef, {
		fields: (t) => ({
			id: t.exposeString("id"),
			title: t.exposeString("title"),
			adoptedAt: t.field({ type: "DateTime", resolve: (r) => r.adoptedAt }),
			body: t.field({ type: "RichTextDocument", resolve: (r) => r.body }),
			authors: t.field({
				type: [PersonRef],
				resolve: (adr, _args, context) => authorsOf(context, adr.id),
			}),
			updatedAt: t.field({
				type: "DateTime",
				nullable: true,
				resolve: (r) => r.updatedAt,
			}),
		}),
	});

	builder.asEntity(AdrRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: (ref) => byId(ref.id),
	});

	PersonRef.implement({
		externalFields: (f) => ({ id: f.string() }),
		fields: (f) => ({
			authoredAdrs: f.field({
				type: [AdrRef],
				resolve: (person, _args, context) => adrsBy(context, person.id),
			}),
		}),
	});

	builder.queryType({
		fields: (t) => ({
			adrById: t.field({
				type: AdrRef,
				nullable: true,
				args: { id: t.arg.string({ required: true }) },
				resolve: (_root, args) => byId(args.id),
			}),
			allAdrs: t.field({
				type: [AdrRef],
				resolve: () =>
					db.select().from(s.adrsTable).orderBy(asc(s.adrsTable.id)).all(),
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@extends", "@external", "@key"],
	});
};
