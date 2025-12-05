import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from 'drizzle-orm/sqlite-core';

export const dailyChallengesTable = sqliteTable(
	'daily_challenges',
	{
		id: text('id').primaryKey(),
		date: text('date').notNull().unique(), // YYYY-MM-DD format
		enemyId: text('enemy_id').notNull(),
		allowedComebacks: text('allowed_comebacks').notNull(), // JSON array of comeback IDs
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	},
	(table) => ({
		dateIdx: index('date_idx').on(table.date),
	}),
);

export const dailyChallengeCompletionsTable = sqliteTable(
	'daily_challenge_completions',
	{
		challengeId: text('challenge_id').notNull(),
		personId: text('person_id').notNull(),
		completedAt: integer('completed_at', { mode: 'timestamp' }).notNull(),
		moveCount: integer('move_count').notNull(),
		timeSeconds: integer('time_seconds').notNull(),
	},
	(table) => ({
		primaryKey: primaryKey({
			columns: [table.challengeId, table.personId],
		}),
		challengeIdx: index('challenge_idx').on(table.challengeId),
	}),
);
