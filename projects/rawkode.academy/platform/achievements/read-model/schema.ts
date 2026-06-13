import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import drizzlePlugin from "@pothos/plugin-drizzle";
import federationPlugin from "@pothos/plugin-federation";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { DateTimeResolver } from "graphql-scalars";
import type { GraphQLSchema } from "graphql";
import * as s from "../data-model/schema";

export interface PothosTypes {
	DrizzleSchema: typeof s;
	Scalars: {
		DateTime: { Input: Date; Output: Date };
	};
}

type PlayerAchievementRow = {
	achievementId: string;
	unlockedAt: Date;
};

const createBuilder = (env: { DB: D1Database }) => {
	const db = drizzle(env.DB);

	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
		drizzle: { client: db },
	});

	builder.addScalarType("DateTime", DateTimeResolver);

	const playerAchievementRef = builder
		.objectRef<PlayerAchievementRow>("PlayerAchievement")
		.implement({
			fields: (t) => ({
				achievementId: t.exposeString("achievementId"),
				unlockedAt: t.field({
					type: "DateTime",
					resolve: (row) => row.unlockedAt,
				}),
			}),
		});

	builder.queryType({
		fields: (t) => ({
			playerAchievements: t.field({
				type: [playerAchievementRef],
				args: {
					namespace: t.arg({ type: "String", required: true }),
					personId: t.arg({ type: "String", required: true }),
				},
				resolve: async (_root, args) => {
					const rows = await db
						.select()
						.from(s.playerAchievementsTable)
						.where(
							and(
								eq(s.playerAchievementsTable.namespace, args.namespace),
								eq(s.playerAchievementsTable.personId, args.personId),
							),
						)
						.all();

					return rows.map((row) => ({
						achievementId: row.achievementId,
						unlockedAt: row.unlockedAt,
					}));
				},
			}),
		}),
	});

	return builder;
};

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const builder = createBuilder(env);
	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@extends", "@external", "@key"],
	});
};
