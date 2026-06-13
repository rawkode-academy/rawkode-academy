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
import type { PlayerStats } from "../write-model/main";

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

type PerCategoryCorrect = {
	sandbox: number;
	incubating: number;
	graduated: number;
	archived: number;
	nonCncf: number;
};

type PlayerStatsRow = PlayerStats & { correctCount: number };

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

	const perCategoryCorrectRef = builder
		.objectRef<PerCategoryCorrect>("PerCategoryCorrect")
		.implement({
			fields: (t) => ({
				sandbox: t.exposeInt("sandbox"),
				incubating: t.exposeInt("incubating"),
				graduated: t.exposeInt("graduated"),
				archived: t.exposeInt("archived"),
				nonCncf: t.exposeInt("nonCncf"),
			}),
		});

	const playerStatsRef = builder
		.objectRef<PlayerStatsRow>("PlayerStats")
		.implement({
			fields: (t) => ({
				weeksPlayed: t.exposeInt("weeksPlayed"),
				lastWeekKey: t.exposeString("lastWeekKey"),
				lastWeekIndex: t.exposeInt("lastWeekIndex"),
				currentStreak: t.exposeInt("currentStreak"),
				longestStreak: t.exposeInt("longestStreak"),
				lifetimeCorrect: t.exposeInt("lifetimeCorrect"),
				perCategoryCorrect: t.field({
					type: perCategoryCorrectRef,
					resolve: (row) => row.perCategoryCorrect,
				}),
				bestScore: t.exposeInt("bestScore"),
				perfectWeeks: t.exposeInt("perfectWeeks"),
				correctCount: t.exposeInt("correctCount"),
				wins: t.exposeInt("wins"),
				podiums: t.exposeInt("podiums"),
				bestRank: t.exposeInt("bestRank"),
				lastCreditedWeek: t.exposeString("lastCreditedWeek"),
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

			playerStats: t.field({
				type: playerStatsRef,
				nullable: true,
				args: {
					namespace: t.arg({ type: "String", required: true }),
					personId: t.arg({ type: "String", required: true }),
				},
				resolve: async (_root, args) => {
					const row = await db
						.select()
						.from(s.playerStatsTable)
						.where(
							and(
								eq(s.playerStatsTable.namespace, args.namespace),
								eq(s.playerStatsTable.personId, args.personId),
							),
						)
						.get();

					if (!row) {
						return null;
					}

					const parsed = JSON.parse(row.stats) as PlayerStats;
					return {
						...parsed,
						correctCount: parsed.correctLogos.length,
					};
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
