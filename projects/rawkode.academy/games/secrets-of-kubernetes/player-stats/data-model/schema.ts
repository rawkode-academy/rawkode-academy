import {
	integer,
	sqliteTable,
	text,
} from 'drizzle-orm/sqlite-core';

export const playerStatsTable = sqliteTable(
	'player_stats',
	{
		personId: text('person_id').primaryKey(),
		totalWins: integer('total_wins').notNull().default(0),
		totalLosses: integer('total_losses').notNull().default(0),
		currentStreak: integer('current_streak').notNull().default(0),
		bestStreak: integer('best_streak').notNull().default(0),
		totalPlayTimeSeconds: integer('total_play_time_seconds').notNull().default(0),
		enemiesDefeated: integer('enemies_defeated').notNull().default(0),
		fastestBreachSeconds: integer('fastest_breach_seconds'),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
	},
);