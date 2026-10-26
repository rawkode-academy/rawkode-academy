import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import * as s from "../data-model/schema";

export interface PothosTypes {
	Context: Record<string, unknown>;
	// Fields are non-null unless they opt out with nullable: true.
	DefaultFieldNullability: false;
}

const subgraph = {
	linkUrl: "https://specs.apollo.dev/federation/v2.6",
	federationDirectives: ["@extends", "@external", "@key"],
};

const supporters = s.supportersTable;
const links = s.supporterTechnologiesTable;

// Started, and not yet ended.
const isActive = (now: Date) =>
	and(
		lte(supporters.startedAt, now),
		or(isNull(supporters.endedAt), gt(supporters.endedAt, now)),
	);

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
		defaultFieldNullability: false,
	});

	const TechnologyRef = builder.externalRef(
		"Technology",
		builder.selection<{ id: string }>("id"),
	);

	const SupporterRef = builder.objectRef<s.Supporter>("Supporter");
	builder.objectType(SupporterRef, {
		fields: (t) => ({
			id: t.exposeID("id"),
			name: t.exposeString("name"),
			websiteUrl: t.exposeString("websiteUrl"),
			logoUrl: t.string({ nullable: true, resolve: (r) => r.logoUrl }),
			technologies: t.field({
				type: [TechnologyRef],
				resolve: (supporter) =>
					db
						.select({ id: links.technologyId })
						.from(links)
						.where(eq(links.supporterId, supporter.id))
						.orderBy(asc(links.technologyId))
						.all(),
			}),
		}),
	});

	builder.asEntity(SupporterRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: (ref) =>
			db.select().from(supporters).where(eq(supporters.id, ref.id)).get(),
	});

	TechnologyRef.implement({
		// Nullable to match Technology.id in the technologies subgraph.
		externalFields: (f) => ({ id: f.id({ nullable: true }) }),
		fields: (f) => ({
			// Null unless an active supporter sponsors this technology.
			supporter: f.field({
				type: SupporterRef,
				nullable: true,
				resolve: async (technology) => {
					const row = await db
						.select({ supporter: supporters })
						.from(links)
						.innerJoin(supporters, eq(links.supporterId, supporters.id))
						.where(
							and(
								eq(links.technologyId, String(technology.id)),
								isActive(new Date()),
							),
						)
						.get();

					return row?.supporter ?? null;
				},
			}),
		}),
	});

	builder.queryType({
		fields: (t) => ({
			// Active supporters, longest-standing first.
			supporters: t.field({
				type: [SupporterRef],
				resolve: () =>
					db
						.select()
						.from(supporters)
						.where(isActive(new Date()))
						.orderBy(asc(supporters.startedAt), asc(supporters.id))
						.all(),
			}),
		}),
	});

	return builder.toSubGraphSchema(subgraph);
};
