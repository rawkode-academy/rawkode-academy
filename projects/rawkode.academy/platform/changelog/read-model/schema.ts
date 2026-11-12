import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import type { DocNode } from "@rawkodeacademy/rich-text";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import { DateTimeResolver, JSONObjectResolver } from "graphql-scalars";
import * as s from "../data-model/schema";

type ChangelogEntry = s.ChangelogEntry;

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
	const t = s.changelogEntriesTable;

	builder.addScalarType("DateTime", DateTimeResolver);
	// A TipTap/ProseMirror JSON document (packages/rich-text). Every subgraph
	// that serves rich text declares this scalar identically, so the supergraph
	// has a single RichTextDocument type.
	builder.addScalarType("RichTextDocument", JSONObjectResolver, {
		description:
			'A TipTap/ProseMirror JSON document ({"type":"doc","content":[...]}), see @rawkodeacademy/rich-text.',
	});

	const byId = (id: string) => db.select().from(t).where(eq(t.id, id)).get();

	const PersonRef = builder.externalRef(
		"Person",
		builder.selection<{ id: string }>("id"),
	);
	PersonRef.implement({
		externalFields: (f) => ({ id: f.string() }),
	});

	const ChangelogEntryTypeEnum = builder.enumType("ChangelogEntryType", {
		values: ["feature", "fix", "improvement", "breaking"] as const,
	});

	const ChangelogEntryRef = builder.objectRef<ChangelogEntry>("ChangelogEntry");
	builder.objectType(ChangelogEntryRef, {
		fields: (f) => ({
			id: f.exposeString("id"),
			title: f.exposeString("title"),
			date: f.field({ type: "DateTime", resolve: (r) => r.date }),
			type: f.field({ type: ChangelogEntryTypeEnum, resolve: (r) => r.type }),
			// The summary, Markdown in the source like the body.
			description: f.field({
				type: "RichTextDocument",
				resolve: (r) => r.description,
			}),
			pullRequest: f.int({ nullable: true, resolve: (r) => r.pullRequest }),
			author: f.field({
				type: PersonRef,
				resolve: (r) => ({ id: r.authorId }),
			}),
			// Nothing renders it today.
			body: f.field({
				type: "RichTextDocument",
				nullable: true,
				resolve: (r) => r.body,
			}),
			updatedAt: f.field({
				type: "DateTime",
				nullable: true,
				resolve: (r) => r.updatedAt,
			}),
		}),
	});

	builder.asEntity(ChangelogEntryRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: (ref) => byId(ref.id),
	});

	builder.queryType({
		fields: (f) => ({
			changelogEntryById: f.field({
				type: ChangelogEntryRef,
				nullable: true,
				args: { id: f.arg.string({ required: true }) },
				resolve: (_root, args) => byId(args.id),
			}),
			// Newest first, like /changelog.
			allChangelogEntries: f.field({
				type: [ChangelogEntryRef],
				resolve: () =>
					db.select().from(t).orderBy(desc(t.date), desc(t.id)).all(),
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@extends", "@external", "@key"],
	});
};
