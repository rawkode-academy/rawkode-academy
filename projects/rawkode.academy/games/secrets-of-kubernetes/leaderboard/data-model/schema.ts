import {
	index,
	integer,
	sqliteTable,
	text,
} from 'drizzle-orm/sqlite-core';

export const leaderboardEntriesTable = sqliteTable(
	'leaderboard_entries',
	{
		id: text('id').primaryKey(),
		personId: text('person_id').notNull(),
		personName: text('person_name'),
		scoreType: text('score_type').notNull(), // fastest_breach, win_streak, total_wins, enemies_defeated
		scoreValue: integer('score_value').notNull(),
		achievedAt: integer('achieved_at', { mode: 'timestamp' }).notNull(),
	},
	(table) => ({
		scoreTypeIdx: index('score_type_idx').on(table.scoreType),
		personScoreIdx: index('person_score_idx').on(table.personId, table.scoreType),
		scoreValueIdx: index('score_value_idx').on(table.scoreType, table.scoreValue),
	}),
);
