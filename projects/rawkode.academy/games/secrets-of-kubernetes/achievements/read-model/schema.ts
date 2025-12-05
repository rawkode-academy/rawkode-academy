import schemaBuilder from '@pothos/core';
import directivesPlugin from '@pothos/plugin-directives';
import drizzlePlugin from '@pothos/plugin-drizzle';
import federationPlugin from '@pothos/plugin-federation';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { type GraphQLSchema } from 'graphql';
import * as dataSchema from '../data-model/schema.ts';

interface AchievementDefinition {
	id: string;
	name: string;
	description: string;
	icon: string;
	criteriaType: string;
	criteriaValue: number;
}

const ACHIEVEMENTS: AchievementDefinition[] = [
	{
		id: 'pod-escaped',
		name: 'Pod Escaped',
		description: 'Win a battle without taking any damage',
		icon: '🏃',
		criteriaType: 'no_damage_win',
		criteriaValue: 1,
	},
	{
		id: 'zero-day',
		name: 'Zero Day',
		description: 'Defeat an enemy on your first try',
		icon: '⚡',
		criteriaType: 'first_try_win',
		criteriaValue: 1,
	},
	{
		id: 'full-arsenal',
		name: 'Full Arsenal',
		description: 'Collect all 15 comebacks',
		icon: '🛡️',
		criteriaType: 'comebacks_collected',
		criteriaValue: 15,
	},
	{
		id: 'cve-collector',
		name: 'CVE Collector',
		description: 'Learn all 15 insults',
		icon: '📚',
		criteriaType: 'insults_collected',
		criteriaValue: 15,
	},
	{
		id: 'rbac-who',
		name: 'RBAC Who?',
		description: 'Defeat all control plane enemies',
		icon: '👑',
		criteriaType: 'control_plane_cleared',
		criteriaValue: 1,
	},
	{
		id: 'speed-demon',
		name: 'Speed Demon',
		description: 'Complete a breach in under 60 seconds',
		icon: '💨',
		criteriaType: 'fastest_breach',
		criteriaValue: 60,
	},
	{
		id: 'perfect-week',
		name: 'Perfect Week',
		description: 'Maintain a 7-day win streak',
		icon: '🔥',
		criteriaType: 'win_streak',
		criteriaValue: 7,
	},
	{
		id: 'first-blood',
		name: 'First Blood',
		description: 'Win your first battle',
		icon: '🩸',
		criteriaType: 'total_wins',
		criteriaValue: 1,
	},
	{
		id: 'veteran',
		name: 'Veteran',
		description: 'Win 25 battles',
		icon: '🎖️',
		criteriaType: 'total_wins',
		criteriaValue: 25,
	},
	{
		id: 'master-hacker',
		name: 'Master Hacker',
		description: 'Win 50 battles',
		icon: '💻',
		criteriaType: 'total_wins',
		criteriaValue: 50,
	},
];

export interface PothosTypes {
	DrizzleSchema: typeof dataSchema;
}

interface Env {
	DB: D1Database;
}

export const getSchema = (env: Env): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: dataSchema });

	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
		drizzle: {
			client: db,
			schema: dataSchema,
		},
	});

	const achievementRef = builder.objectRef<AchievementDefinition>('Achievement').implement({
		fields: (t) => ({
			id: t.exposeString('id'),
			name: t.exposeString('name'),
			description: t.exposeString('description'),
			icon: t.exposeString('icon'),
			criteriaType: t.exposeString('criteriaType'),
			criteriaValue: t.exposeInt('criteriaValue'),
		}),
	});

	const playerAchievementRef = builder.objectRef<{
		achievement: AchievementDefinition;
		unlockedAt: Date;
	}>('PlayerAchievement').implement({
		fields: (t) => ({
			achievement: t.field({
				type: achievementRef,
				resolve: (parent) => parent.achievement,
			}),
			unlockedAt: t.string({
				resolve: (parent) => parent.unlockedAt.toISOString(),
			}),
		}),
	});

	// Extend PlayerProgress from player-progress service
	const playerProgressRef = builder.externalRef(
		'PlayerProgress',
		builder.selection<{ personId: string }>('personId'),
	).implement({
		externalFields: (t) => ({
			personId: t.string(),
		}),
		fields: (t) => ({
			achievements: t.field({
				type: [playerAchievementRef],
				resolve: async (parent) => {
					const unlocked = await db.query.playerAchievementsTable.findMany({
						where: eq(dataSchema.playerAchievementsTable.personId, parent.personId),
					});

					return unlocked.map((u) => {
						const achievement = ACHIEVEMENTS.find((a) => a.id === u.achievementId);
						return {
							achievement: achievement!,
							unlockedAt: u.unlockedAt,
						};
					}).filter((a) => a.achievement);
				},
			}),
		}),
	});

	builder.queryType({
		fields: (t) => ({
			allAchievements: t.field({
				type: [achievementRef],
				resolve: () => ACHIEVEMENTS,
			}),

			playerAchievements: t.field({
				type: [playerAchievementRef],
				args: {
					personId: t.arg.string({ required: true }),
				},
				resolve: async (_root, args) => {
					const unlocked = await db.query.playerAchievementsTable.findMany({
						where: eq(dataSchema.playerAchievementsTable.personId, args.personId),
					});

					return unlocked.map((u) => {
						const achievement = ACHIEVEMENTS.find((a) => a.id === u.achievementId);
						return {
							achievement: achievement!,
							unlockedAt: u.unlockedAt,
						};
					}).filter((a) => a.achievement);
				},
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: 'https://specs.apollo.dev/federation/v2.6',
		federationDirectives: ['@extends', '@external', '@key'],
	});
};
