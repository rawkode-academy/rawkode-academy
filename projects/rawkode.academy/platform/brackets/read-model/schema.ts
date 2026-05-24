import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import drizzlePlugin from "@pothos/plugin-drizzle";
import federationPlugin from "@pothos/plugin-federation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
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

type MatchRow = typeof s.matches.$inferSelect;
type BracketRow = typeof s.brackets.$inferSelect;
type SeasonRow = typeof s.seasons.$inferSelect;
type Side = { kind: "team" | "entry"; id: string; displayName: string; seed: number | null };

const createBuilder = (env: { DB: D1Database }) => {
	const db = drizzle(env.DB);

	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
		drizzle: { client: db },
	});

	builder.addScalarType("DateTime", DateTimeResolver);

	// ---- data helpers (all scoped through showId via seasons) ----

	const seasonsForShow = (showId: string) =>
		db.select().from(s.seasons).where(eq(s.seasons.showId, showId)).all();

	const seasonIdsForShow = async (showId: string, seasonSlug?: string | null) => {
		const rows = await seasonsForShow(showId);
		return rows
			.filter((r) => (seasonSlug ? r.slug === seasonSlug : true))
			.map((r) => r.id);
	};

	const bracketsForSeasons = (seasonIds: string[]) =>
		seasonIds.length === 0
			? Promise.resolve([] as BracketRow[])
			: db
					.select()
					.from(s.brackets)
					.where(inArray(s.brackets.seasonId, seasonIds))
					.all();

	const matchesForBrackets = (bracketIds: string[]) =>
		bracketIds.length === 0
			? Promise.resolve([] as MatchRow[])
			: db
					.select()
					.from(s.matches)
					.where(inArray(s.matches.bracketId, bracketIds))
					.orderBy(asc(s.matches.scheduledAt))
					.all();

	const resolveSide = async (
		teamId: string | null,
		entryId: string | null,
	): Promise<Side | null> => {
		if (entryId) {
			const entry = await db
				.select()
				.from(s.bracketEntries)
				.where(eq(s.bracketEntries.id, entryId))
				.get();
			if (entry)
				return {
					kind: "entry",
					id: entry.id,
					displayName: entry.displayName,
					seed: entry.seed,
				};
		}
		if (teamId) {
			const team = await db
				.select()
				.from(s.teams)
				.where(eq(s.teams.id, teamId))
				.get();
			if (team)
				return { kind: "team", id: team.id, displayName: team.name, seed: null };
		}
		return null;
	};

	// ---- object types ----

	const sideRef = builder.objectRef<Side>("MatchSide").implement({
		fields: (t) => ({
			kind: t.exposeString("kind"),
			id: t.exposeString("id"),
			displayName: t.exposeString("displayName"),
			seed: t.exposeInt("seed", { nullable: true }),
		}),
	});

	const matchRef = builder.objectRef<MatchRow>("BracketMatch").implement({
		fields: (t) => ({
			id: t.exposeString("id"),
			bracketId: t.exposeString("bracketId"),
			roundNumber: t.exposeInt("roundNumber"),
			positionInRound: t.exposeInt("positionInRound"),
			status: t.exposeString("status"),
			scheduledAt: t.field({
				type: "DateTime",
				nullable: true,
				resolve: (m) => m.scheduledAt,
			}),
			startedAt: t.field({
				type: "DateTime",
				nullable: true,
				resolve: (m) => m.startedAt,
			}),
			endedAt: t.field({
				type: "DateTime",
				nullable: true,
				resolve: (m) => m.endedAt,
			}),
			sideA: t.field({
				type: sideRef,
				nullable: true,
				resolve: (m) => resolveSide(m.teamAId, m.entryAId),
			}),
			sideB: t.field({
				type: sideRef,
				nullable: true,
				resolve: (m) => resolveSide(m.teamBId, m.entryBId),
			}),
			winner: t.field({
				type: sideRef,
				nullable: true,
				resolve: (m) =>
					m.winnerTeamId || m.winnerEntryId
						? resolveSide(m.winnerTeamId, m.winnerEntryId)
						: null,
			}),
			scenarioTitle: t.field({
				type: "String",
				nullable: true,
				resolve: async (m) => {
					if (!m.scenarioId) return null;
					const scenario = await db
						.select({ title: s.scenarios.title })
						.from(s.scenarios)
						.where(eq(s.scenarios.id, m.scenarioId))
						.get();
					return scenario?.title ?? null;
				},
			}),
		}),
	});

	const bracketRef = builder.objectRef<BracketRow>("Bracket").implement({
		fields: (t) => ({
			id: t.exposeString("id"),
			seasonId: t.exposeString("seasonId"),
			slug: t.exposeString("slug"),
			name: t.exposeString("name"),
			kind: t.exposeString("kind"),
			format: t.exposeString("format"),
			status: t.exposeString("status"),
			maxEntries: t.exposeInt("maxEntries"),
			cadenceDays: t.exposeInt("cadenceDays"),
			startsAt: t.field({
				type: "DateTime",
				nullable: true,
				resolve: (b) => b.startsAt,
			}),
			registrationClosesAt: t.field({
				type: "DateTime",
				nullable: true,
				resolve: (b) => b.registrationClosesAt,
			}),
			matches: t.field({
				type: [matchRef],
				resolve: (b) => matchesForBrackets([b.id]),
			}),
			entries: t.field({
				type: [sideRef],
				resolve: async (b) => {
					const entries = await db
						.select()
						.from(s.bracketEntries)
						.where(eq(s.bracketEntries.bracketId, b.id))
						.orderBy(asc(s.bracketEntries.seed))
						.all();
					return entries.map((e) => ({
						kind: "entry" as const,
						id: e.id,
						displayName: e.displayName,
						seed: e.seed,
					}));
				},
			}),
		}),
	});

	const seasonRef = builder.objectRef<SeasonRow>("BracketSeason").implement({
		fields: (t) => ({
			id: t.exposeString("id"),
			slug: t.exposeString("slug"),
			name: t.exposeString("name"),
			status: t.exposeString("status"),
			startDate: t.field({
				type: "DateTime",
				nullable: true,
				resolve: (r) => r.startDate,
			}),
			endDate: t.field({
				type: "DateTime",
				nullable: true,
				resolve: (r) => r.endDate,
			}),
			brackets: t.field({
				type: [bracketRef],
				resolve: (r) => bracketsForSeasons([r.id]),
			}),
		}),
	});

	const standingRef = builder
		.objectRef<{ id: string; displayName: string; wins: number; losses: number }>(
			"BracketStanding",
		)
		.implement({
			fields: (t) => ({
				id: t.exposeString("id"),
				displayName: t.exposeString("displayName"),
				wins: t.exposeInt("wins"),
				losses: t.exposeInt("losses"),
			}),
		});

	// ---- higher-level resolvers used by the Show extension ----

	const showBrackets = async (
		showId: string,
		seasonSlug?: string | null,
		status?: string | null,
	) => {
		const seasonIds = await seasonIdsForShow(showId, seasonSlug);
		const rows = await bracketsForSeasons(seasonIds);
		return status ? rows.filter((b) => b.status === status) : rows;
	};

	const showSchedule = async (showId: string, seasonSlug?: string | null) => {
		const seasonIds = await seasonIdsForShow(showId, seasonSlug);
		const brackets = await bracketsForSeasons(seasonIds);
		return matchesForBrackets(brackets.map((b) => b.id));
	};

	const showLiveMatch = async (showId: string) => {
		const matches = await showSchedule(showId);
		return matches.find((m) => m.status === "live") ?? null;
	};

	const showLeaderboard = async (showId: string, seasonSlug?: string | null) => {
		const matches = (await showSchedule(showId, seasonSlug)).filter(
			(m) => m.status === "completed",
		);
		const table = new Map<
			string,
			{ id: string; displayName: string; wins: number; losses: number }
		>();
		const bump = async (
			teamId: string | null,
			entryId: string | null,
			key: "wins" | "losses",
		) => {
			const side = await resolveSide(teamId, entryId);
			if (!side) return;
			const cur = table.get(side.id) ?? {
				id: side.id,
				displayName: side.displayName,
				wins: 0,
				losses: 0,
			};
			cur[key] += 1;
			table.set(side.id, cur);
		};
		for (const m of matches) {
			const winnerIsA =
				(m.winnerEntryId && m.winnerEntryId === m.entryAId) ||
				(m.winnerTeamId && m.winnerTeamId === m.teamAId);
			await bump(m.winnerTeamId, m.winnerEntryId, "wins");
			if (winnerIsA) await bump(m.teamBId, m.entryBId, "losses");
			else await bump(m.teamAId, m.entryAId, "losses");
		}
		return [...table.values()].sort((a, b) => b.wins - a.wins);
	};

	const openBrackets = async (showId: string) => {
		const now = Date.now();
		const rows = await showBrackets(showId);
		return rows.filter(
			(b) =>
				b.status !== "finished" &&
				(!b.registrationClosesAt || b.registrationClosesAt.getTime() > now),
		);
	};

	// ---- federation: extend the Show entity owned by the website subgraph ----

	builder
		.externalRef("Show", builder.selection<{ id: string }>("id"))
		.implement({
			externalFields: (t) => ({ id: t.string() }),
			fields: (t) => ({
				seasons: t.field({
					type: [seasonRef],
					resolve: (show) => seasonsForShow(show.id),
				}),
				brackets: t.field({
					type: [bracketRef],
					args: {
						seasonSlug: t.arg({ type: "String", required: false }),
						status: t.arg({ type: "String", required: false }),
					},
					resolve: (show, args) =>
						showBrackets(show.id, args.seasonSlug, args.status),
				}),
				schedule: t.field({
					type: [matchRef],
					args: { seasonSlug: t.arg({ type: "String", required: false }) },
					resolve: (show, args) => showSchedule(show.id, args.seasonSlug),
				}),
				liveMatch: t.field({
					type: matchRef,
					nullable: true,
					resolve: (show) => showLiveMatch(show.id),
				}),
				leaderboard: t.field({
					type: [standingRef],
					args: { seasonSlug: t.arg({ type: "String", required: false }) },
					resolve: (show, args) => showLeaderboard(show.id, args.seasonSlug),
				}),
				openBrackets: t.field({
					type: [bracketRef],
					resolve: (show) => openBrackets(show.id),
				}),
			}),
		});

	// ---- top-level queries (admin / direct access) ----

	builder.queryType({
		fields: (t) => ({
			bracket: t.field({
				type: bracketRef,
				nullable: true,
				args: { id: t.arg({ type: "String", required: true }) },
				resolve: (_root, args) =>
					db.select().from(s.brackets).where(eq(s.brackets.id, args.id)).get(),
			}),
			bracketBySlug: t.field({
				type: bracketRef,
				nullable: true,
				args: {
					showId: t.arg({ type: "String", required: true }),
					seasonSlug: t.arg({ type: "String", required: true }),
					bracketSlug: t.arg({ type: "String", required: true }),
				},
				resolve: async (_root, args) => {
					const seasonIds = await seasonIdsForShow(args.showId, args.seasonSlug);
					if (seasonIds.length === 0) return null;
					return db
						.select()
						.from(s.brackets)
						.where(
							and(
								inArray(s.brackets.seasonId, seasonIds),
								eq(s.brackets.slug, args.bracketSlug),
							),
						)
						.get();
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
