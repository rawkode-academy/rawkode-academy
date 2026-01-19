import { defineAction, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import { eq, and, desc, asc, or, inArray } from "drizzle-orm";
import { createDb } from "@/db/client";
import { brackets, competitors, matches } from "@/db/schema";
import {
	generateSingleEliminationBracket,
	getNextMatch,
	getWinnerSlot,
	isBracketComplete,
} from "@/lib/bracket-utils";
import { createLearnerId } from "./newsletter";

const ADMIN_USER_IDS = ["rawkode"];

function isAdmin(userId: string | undefined): boolean {
	if (!userId) return false;
	return ADMIN_USER_IDS.includes(userId);
}

function getEnv(context: ActionAPIContext) {
	return context.locals.runtime.env;
}

export const bracket = {
	getBracket: defineAction({
		input: z.object({
			slug: z.string(),
		}),
		handler: async (input, context) => {
			const env = getEnv(context);
			const db = createDb(env.DB);

			const bracketData = await db.query.brackets.findFirst({
				where: eq(brackets.slug, input.slug),
			});

			if (!bracketData) {
				throw new Error("Bracket not found");
			}

			const competitorsList = await db.query.competitors.findMany({
				where: eq(competitors.bracketId, bracketData.id),
				orderBy: [asc(competitors.seed), asc(competitors.createdAt)],
			});

			const matchesList = await db.query.matches.findMany({
				where: eq(matches.bracketId, bracketData.id),
				orderBy: [asc(matches.round), asc(matches.position)],
			});

			return {
				bracket: bracketData,
				competitors: competitorsList,
				matches: matchesList,
			};
		},
	}),

	getActiveBrackets: defineAction({
		handler: async (_input, context) => {
			const env = getEnv(context);
			const db = createDb(env.DB);

			const activeBrackets = await db.query.brackets.findMany({
				where: eq(brackets.status, "active"),
				orderBy: [desc(brackets.startedAt)],
			});

			return activeBrackets;
		},
	}),

	getAllBrackets: defineAction({
		handler: async (_input, context) => {
			if (!isAdmin(context.locals.user?.id)) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const db = createDb(env.DB);

			const allBrackets = await db.query.brackets.findMany({
				orderBy: [desc(brackets.createdAt)],
			});

			return allBrackets;
		},
	}),

	getMyParticipation: defineAction({
		handler: async (_input, context) => {
			if (!context.locals.user) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const db = createDb(env.DB);
			const prefixedUserId = createLearnerId(context.locals.user.id);

			const myCompetitors = await db.query.competitors.findMany({
				where: eq(competitors.userId, prefixedUserId),
			});

			const bracketIds = [...new Set(myCompetitors.map((c) => c.bracketId))];
			const bracketsData = await Promise.all(
				bracketIds.map((id) =>
					db.query.brackets.findFirst({
						where: eq(brackets.id, id),
					}),
				),
			);

			return myCompetitors.map((competitor) => ({
				competitor,
				bracket: bracketsData.find((b) => b?.id === competitor.bracketId),
			}));
		},
	}),

	confirmParticipation: defineAction({
		input: z.object({
			bracketId: z.string(),
		}),
		handler: async (input, context) => {
			if (!context.locals.user) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const db = createDb(env.DB);
			const prefixedUserId = createLearnerId(context.locals.user.id);

			const competitor = await db.query.competitors.findFirst({
				where: and(
					eq(competitors.bracketId, input.bracketId),
					eq(competitors.userId, prefixedUserId),
				),
			});

			if (!competitor) {
				throw new Error("You are not registered for this bracket");
			}

			if (competitor.confirmed) {
				return { success: true, message: "Already confirmed" };
			}

			await db
				.update(competitors)
				.set({
					confirmed: true,
					confirmedAt: new Date(),
				})
				.where(eq(competitors.id, competitor.id));

			return { success: true };
		},
	}),

	withdrawParticipation: defineAction({
		input: z.object({
			bracketId: z.string(),
		}),
		handler: async (input, context) => {
			if (!context.locals.user) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const db = createDb(env.DB);
			const prefixedUserId = createLearnerId(context.locals.user.id);

			const bracketData = await db.query.brackets.findFirst({
				where: eq(brackets.id, input.bracketId),
			});

			if (!bracketData) {
				throw new Error("Bracket not found");
			}

			if (bracketData.status !== "draft" && bracketData.status !== "registration") {
				throw new Error("Cannot withdraw from an active or completed bracket");
			}

			const competitor = await db.query.competitors.findFirst({
				where: and(
					eq(competitors.bracketId, input.bracketId),
					eq(competitors.userId, prefixedUserId),
				),
			});

			if (!competitor) {
				throw new Error("You are not registered for this bracket");
			}

			await db
				.update(competitors)
				.set({
					confirmed: false,
					confirmedAt: null,
				})
				.where(eq(competitors.id, competitor.id));

			return { success: true };
		},
	}),

	createBracket: defineAction({
		input: z.object({
			name: z.string().min(1),
			slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
			type: z.enum(["solo", "team"]),
			description: z.string().optional(),
		}),
		handler: async (input, context) => {
			if (!isAdmin(context.locals.user?.id)) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const db = createDb(env.DB);

			const existing = await db.query.brackets.findFirst({
				where: eq(brackets.slug, input.slug),
			});

			if (existing) {
				throw new Error("A bracket with this slug already exists");
			}

			const [newBracket] = await db
				.insert(brackets)
				.values({
					name: input.name,
					slug: input.slug,
					type: input.type,
					description: input.description,
				})
				.returning();

			return newBracket;
		},
	}),

	updateBracket: defineAction({
		input: z.object({
			id: z.string(),
			name: z.string().min(1).optional(),
			slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
			description: z.string().optional(),
			status: z.enum(["draft", "registration", "active", "completed"]).optional(),
		}),
		handler: async (input, context) => {
			if (!isAdmin(context.locals.user?.id)) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const db = createDb(env.DB);
			const { id, ...updates } = input;

			const existingBracket = await db.query.brackets.findFirst({
				where: eq(brackets.id, id),
			});

			if (!existingBracket) {
				throw new Error("Bracket not found");
			}

			if (updates.slug && updates.slug !== existingBracket.slug) {
				const slugExists = await db.query.brackets.findFirst({
					where: eq(brackets.slug, updates.slug),
				});
				if (slugExists) {
					throw new Error("A bracket with this slug already exists");
				}
			}

			const updateData: Record<string, unknown> = {
				...updates,
				updatedAt: new Date(),
			};

			if (updates.status === "active" && existingBracket.status !== "active") {
				updateData.startedAt = new Date();
			}

			if (updates.status === "completed" && existingBracket.status !== "completed") {
				updateData.completedAt = new Date();
			}

			const [updated] = await db
				.update(brackets)
				.set(updateData)
				.where(eq(brackets.id, id))
				.returning();

			return updated;
		},
	}),

	deleteBracket: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async (input, context) => {
			if (!isAdmin(context.locals.user?.id)) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const db = createDb(env.DB);

			await db.delete(brackets).where(eq(brackets.id, input.id));

			return { success: true };
		},
	}),

	importRegistrations: defineAction({
		input: z.object({
			bracketId: z.string(),
		}),
		handler: async (input, context) => {
			if (!isAdmin(context.locals.user?.id)) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const db = createDb(env.DB);

			const bracketData = await db.query.brackets.findFirst({
				where: eq(brackets.id, input.bracketId),
			});

			if (!bracketData) {
				throw new Error("Bracket not found");
			}

			const audience = `klustered-${bracketData.type}`;
			const registrations =
				await env.EMAIL_PREFERENCES.getPreferences(
					undefined,
					"newsletter",
					audience,
				);

			const existingCompetitors = await db.query.competitors.findMany({
				where: eq(competitors.bracketId, input.bracketId),
			});

			const existingUserIds = new Set(existingCompetitors.map((c) => c.userId));

			const newRegistrations = registrations.filter(
				(r) => !existingUserIds.has(r.userId),
			);

			if (newRegistrations.length === 0) {
				return { imported: 0, total: existingCompetitors.length };
			}

			const newCompetitors = newRegistrations.map((r) => ({
				bracketId: input.bracketId,
				name: r.userId.replace("learner:", ""),
				userId: r.userId,
				confirmed: false,
			}));

			await db.insert(competitors).values(newCompetitors);

			return {
				imported: newRegistrations.length,
				total: existingCompetitors.length + newRegistrations.length,
			};
		},
	}),

	addCompetitor: defineAction({
		input: z.object({
			bracketId: z.string(),
			name: z.string().min(1),
			displayName: z.string().optional(),
			userId: z.string().optional(),
			imageUrl: z.string().url().optional(),
		}),
		handler: async (input, context) => {
			if (!isAdmin(context.locals.user?.id)) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const db = createDb(env.DB);

			const [newCompetitor] = await db
				.insert(competitors)
				.values({
					bracketId: input.bracketId,
					name: input.name,
					displayName: input.displayName,
					userId: input.userId,
					imageUrl: input.imageUrl,
					confirmed: true,
					confirmedAt: new Date(),
				})
				.returning();

			return newCompetitor;
		},
	}),

	removeCompetitor: defineAction({
		input: z.object({
			competitorId: z.string(),
		}),
		handler: async (input, context) => {
			if (!isAdmin(context.locals.user?.id)) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const db = createDb(env.DB);

			await db.delete(competitors).where(eq(competitors.id, input.competitorId));

			return { success: true };
		},
	}),

	updateCompetitor: defineAction({
		input: z.object({
			competitorId: z.string(),
			name: z.string().min(1).optional(),
			displayName: z.string().optional(),
			imageUrl: z.string().url().optional().nullable(),
			seed: z.number().int().positive().optional().nullable(),
			confirmed: z.boolean().optional(),
		}),
		handler: async (input, context) => {
			if (!isAdmin(context.locals.user?.id)) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const db = createDb(env.DB);
			const { competitorId, ...updates } = input;

			const updateData: Record<string, unknown> = { ...updates };

			if (updates.confirmed === true) {
				updateData.confirmedAt = new Date();
			} else if (updates.confirmed === false) {
				updateData.confirmedAt = null;
			}

			const [updated] = await db
				.update(competitors)
				.set(updateData)
				.where(eq(competitors.id, competitorId))
				.returning();

			return updated;
		},
	}),

	setSeed: defineAction({
		input: z.object({
			competitorId: z.string(),
			seed: z.number().int().positive().nullable(),
		}),
		handler: async (input, context) => {
			if (!isAdmin(context.locals.user?.id)) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const db = createDb(env.DB);

			const [updated] = await db
				.update(competitors)
				.set({ seed: input.seed })
				.where(eq(competitors.id, input.competitorId))
				.returning();

			return updated;
		},
	}),

	generateMatches: defineAction({
		input: z.object({
			bracketId: z.string(),
		}),
		handler: async (input, context) => {
			if (!isAdmin(context.locals.user?.id)) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const db = createDb(env.DB);

			const bracketData = await db.query.brackets.findFirst({
				where: eq(brackets.id, input.bracketId),
			});

			if (!bracketData) {
				throw new Error("Bracket not found");
			}

			if (bracketData.status === "active" || bracketData.status === "completed") {
				throw new Error("Cannot regenerate matches for an active or completed bracket");
			}

			const existingMatches = await db.query.matches.findMany({
				where: eq(matches.bracketId, input.bracketId),
			});

			if (existingMatches.length > 0) {
				await db.delete(matches).where(eq(matches.bracketId, input.bracketId));
			}

			const competitorsList = await db.query.competitors.findMany({
				where: eq(competitors.bracketId, input.bracketId),
			});

			const newMatches = generateSingleEliminationBracket(
				input.bracketId,
				competitorsList,
			);

			await db.insert(matches).values(newMatches);

			return {
				success: true,
				matchCount: newMatches.length,
			};
		},
	}),

	startBracket: defineAction({
		input: z.object({
			bracketId: z.string(),
		}),
		handler: async (input, context) => {
			if (!isAdmin(context.locals.user?.id)) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const db = createDb(env.DB);

			const bracketData = await db.query.brackets.findFirst({
				where: eq(brackets.id, input.bracketId),
			});

			if (!bracketData) {
				throw new Error("Bracket not found");
			}

			const matchesList = await db.query.matches.findMany({
				where: eq(matches.bracketId, input.bracketId),
			});

			if (matchesList.length === 0) {
				throw new Error("Generate matches before starting the bracket");
			}

			const [updated] = await db
				.update(brackets)
				.set({
					status: "active",
					startedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(brackets.id, input.bracketId))
				.returning();

			return updated;
		},
	}),

	setMatchResult: defineAction({
		input: z.object({
			matchId: z.string(),
			winnerId: z.string(),
		}),
		handler: async (input, context) => {
			if (!isAdmin(context.locals.user?.id)) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const db = createDb(env.DB);

			const match = await db.query.matches.findFirst({
				where: eq(matches.id, input.matchId),
			});

			if (!match) {
				throw new Error("Match not found");
			}

			if (
				input.winnerId !== match.competitor1Id &&
				input.winnerId !== match.competitor2Id
			) {
				throw new Error("Winner must be one of the match competitors");
			}

			await db
				.update(matches)
				.set({
					winnerId: input.winnerId,
					status: "completed",
					completedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(matches.id, input.matchId));

			const allMatches = await db.query.matches.findMany({
				where: eq(matches.bracketId, match.bracketId),
			});

			const updatedMatch = allMatches.find((m) => m.id === input.matchId)!;
			const nextMatch = getNextMatch(allMatches, updatedMatch);

			if (nextMatch) {
				const slot = getWinnerSlot(match.position);
				await db
					.update(matches)
					.set({
						[slot]: input.winnerId,
						updatedAt: new Date(),
					})
					.where(eq(matches.id, nextMatch.id));
			}

			const refreshedMatches = await db.query.matches.findMany({
				where: eq(matches.bracketId, match.bracketId),
			});

			if (isBracketComplete(refreshedMatches)) {
				await db
					.update(brackets)
					.set({
						status: "completed",
						completedAt: new Date(),
						updatedAt: new Date(),
					})
					.where(eq(brackets.id, match.bracketId));
			}

			return { success: true };
		},
	}),

	updateMatch: defineAction({
		input: z.object({
			matchId: z.string(),
			status: z.enum(["pending", "scheduled", "live", "completed"]).optional(),
			scheduledAt: z.string().datetime().optional().nullable(),
			streamUrl: z.string().url().optional().nullable(),
			vodUrl: z.string().url().optional().nullable(),
			notes: z.string().optional().nullable(),
		}),
		handler: async (input, context) => {
			if (!isAdmin(context.locals.user?.id)) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const db = createDb(env.DB);
			const { matchId, scheduledAt, ...updates } = input;

			const updateData: Record<string, unknown> = {
				...updates,
				updatedAt: new Date(),
			};

			if (scheduledAt !== undefined) {
				updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
			}

			const [updated] = await db
				.update(matches)
				.set(updateData)
				.where(eq(matches.id, matchId))
				.returning();

			return updated;
		},
	}),

	getBracketById: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async (input, context) => {
			if (!isAdmin(context.locals.user?.id)) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const db = createDb(env.DB);

			const bracketData = await db.query.brackets.findFirst({
				where: eq(brackets.id, input.id),
			});

			if (!bracketData) {
				throw new Error("Bracket not found");
			}

			const competitorsList = await db.query.competitors.findMany({
				where: eq(competitors.bracketId, bracketData.id),
				orderBy: [asc(competitors.seed), asc(competitors.createdAt)],
			});

			const matchesList = await db.query.matches.findMany({
				where: eq(matches.bracketId, bracketData.id),
				orderBy: [asc(matches.round), asc(matches.position)],
			});

			return {
				bracket: bracketData,
				competitors: competitorsList,
				matches: matchesList,
			};
		},
	}),

	getFullSchedule: defineAction({
		input: z.object({
			bracketId: z.string().optional(),
			status: z.enum(["all", "upcoming", "live", "completed"]).optional(),
		}).optional(),
		handler: async (input, context) => {
			const env = getEnv(context);
			const db = createDb(env.DB);

			const visibleBrackets = await db.query.brackets.findMany({
				where: or(
					eq(brackets.status, "registration"),
					eq(brackets.status, "active"),
					eq(brackets.status, "completed"),
				),
				orderBy: [desc(brackets.startedAt), desc(brackets.createdAt)],
			});

			if (visibleBrackets.length === 0) {
				return { brackets: [], matches: [], competitors: [] };
			}

			let bracketIds = visibleBrackets.map((b) => b.id);

			if (input?.bracketId) {
				bracketIds = bracketIds.filter((id) => id === input.bracketId);
			}

			if (bracketIds.length === 0) {
				return { brackets: [], matches: [], competitors: [] };
			}

			let allMatches = await db.query.matches.findMany({
				where: inArray(matches.bracketId, bracketIds),
				orderBy: [asc(matches.scheduledAt), asc(matches.round), asc(matches.position)],
			});

			if (input?.status && input.status !== "all") {
				if (input.status === "upcoming") {
					allMatches = allMatches.filter(
						(m) => m.status === "scheduled" || m.status === "pending",
					);
				} else if (input.status === "live") {
					allMatches = allMatches.filter((m) => m.status === "live");
				} else if (input.status === "completed") {
					allMatches = allMatches.filter((m) => m.status === "completed");
				}
			}

			const allCompetitors = await db.query.competitors.findMany({
				where: inArray(competitors.bracketId, bracketIds),
			});

			const competitorMap = new Map(allCompetitors.map((c) => [c.id, c]));
			const bracketMap = new Map(visibleBrackets.map((b) => [b.id, b]));

			const enrichedMatches = allMatches.map((match) => ({
				...match,
				bracket: bracketMap.get(match.bracketId) ?? null,
				competitor1: match.competitor1Id
					? competitorMap.get(match.competitor1Id) ?? null
					: null,
				competitor2: match.competitor2Id
					? competitorMap.get(match.competitor2Id) ?? null
					: null,
				winner: match.winnerId
					? competitorMap.get(match.winnerId) ?? null
					: null,
			}));

			return {
				brackets: visibleBrackets,
				matches: enrichedMatches,
				competitors: allCompetitors,
			};
		},
	}),

	getHomepageData: defineAction({
		handler: async (_input, context) => {
			const env = getEnv(context);
			const db = createDb(env.DB);

			const visibleBrackets = await db.query.brackets.findMany({
				where: or(
					eq(brackets.status, "registration"),
					eq(brackets.status, "active"),
					eq(brackets.status, "completed"),
				),
				orderBy: [desc(brackets.startedAt), desc(brackets.createdAt)],
			});

			const bracketIds = visibleBrackets.map((b) => b.id);

			let allMatches: typeof matches.$inferSelect[] = [];
			let allCompetitors: typeof competitors.$inferSelect[] = [];

			if (bracketIds.length > 0) {
				allMatches = await db.query.matches.findMany({
					where: inArray(matches.bracketId, bracketIds),
					orderBy: [desc(matches.completedAt), desc(matches.scheduledAt)],
				});

				allCompetitors = await db.query.competitors.findMany({
					where: inArray(competitors.bracketId, bracketIds),
				});
			}

			const liveMatches = allMatches.filter((m) => m.status === "live");

			const recentCompleted = allMatches
				.filter((m) => m.status === "completed" && m.completedAt)
				.sort(
					(a, b) =>
						(b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
				)
				.slice(0, 5);

			const upcomingScheduled = allMatches
				.filter((m) => m.status === "scheduled" && m.scheduledAt)
				.sort(
					(a, b) =>
						(a.scheduledAt?.getTime() ?? 0) - (b.scheduledAt?.getTime() ?? 0),
				)
				.slice(0, 5);

			const bracketsWithCounts = visibleBrackets.map((bracket) => {
				const bracketCompetitors = allCompetitors.filter(
					(c) => c.bracketId === bracket.id && c.confirmed,
				);
				const bracketMatches = allMatches.filter(
					(m) => m.bracketId === bracket.id,
				);

				const totalRounds = bracketMatches.length > 0
					? Math.max(...bracketMatches.map((m) => m.round))
					: 0;

				const completedRounds = bracketMatches.length > 0
					? bracketMatches.reduce((maxCompletedRound, match) => {
							const roundMatches = bracketMatches.filter(
								(m) => m.round === match.round,
							);
							const allCompleted = roundMatches.every(
								(m) => m.status === "completed",
							);
							if (allCompleted && match.round > maxCompletedRound) {
								return match.round;
							}
							return maxCompletedRound;
						}, 0)
					: 0;

				const currentRound = Math.min(completedRounds + 1, totalRounds);

				const remainingCompetitors = bracketMatches
					.filter((m) => m.round === currentRound)
					.reduce((count, match) => {
						return count + (match.competitor1Id ? 1 : 0) + (match.competitor2Id ? 1 : 0);
					}, 0);

				const nextMatch = bracketMatches
					.filter((m) => m.scheduledAt && m.status !== "completed")
					.sort(
						(a, b) =>
							(a.scheduledAt?.getTime() ?? 0) - (b.scheduledAt?.getTime() ?? 0),
					)[0];

				let champion: typeof allCompetitors[0] | null = null;
				if (bracket.status === "completed" && totalRounds > 0) {
					const finalMatch = bracketMatches.find(
						(m) => m.round === totalRounds && m.status === "completed",
					);
					if (finalMatch?.winnerId) {
						champion = allCompetitors.find((c) => c.id === finalMatch.winnerId) ?? null;
					}
				}

				return {
					...bracket,
					competitorCount: bracketCompetitors.length,
					totalRounds,
					currentRound,
					remainingCompetitors: remainingCompetitors || bracketCompetitors.length,
					nextMatch: nextMatch ?? null,
					champion,
				};
			});

			let userParticipation: {
				bracketId: string;
				confirmed: boolean;
			}[] = [];

			if (context.locals.user) {
				const prefixedUserId = createLearnerId(context.locals.user.id);
				const userCompetitors = await db.query.competitors.findMany({
					where: eq(competitors.userId, prefixedUserId),
				});
				userParticipation = userCompetitors.map((c) => ({
					bracketId: c.bracketId,
					confirmed: c.confirmed,
				}));
			}

			const competitorMap = new Map(allCompetitors.map((c) => [c.id, c]));

			const enrichMatch = (match: typeof matches.$inferSelect) => {
				const bracket = visibleBrackets.find((b) => b.id === match.bracketId);
				return {
					...match,
					bracket: bracket ?? null,
					competitor1: match.competitor1Id
						? competitorMap.get(match.competitor1Id) ?? null
						: null,
					competitor2: match.competitor2Id
						? competitorMap.get(match.competitor2Id) ?? null
						: null,
					winner: match.winnerId
						? competitorMap.get(match.winnerId) ?? null
						: null,
				};
			};

			return {
				brackets: bracketsWithCounts,
				liveMatches: liveMatches.map(enrichMatch),
				recentCompleted: recentCompleted.map(enrichMatch),
				upcomingScheduled: upcomingScheduled.map(enrichMatch),
				userParticipation,
			};
		},
	}),
};
