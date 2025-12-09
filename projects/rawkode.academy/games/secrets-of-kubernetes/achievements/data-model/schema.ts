import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from 'drizzle-orm/sqlite-core';

export const playerAchievementsTable = sqliteTable(
	'player_achievements',
	{
		personId: text('person_id').notNull(),
		achievementId: text('achievement_id').notNull(),
		unlockedAt: integer('unlocked_at', { mode: 'timestamp' }).notNull(),
	},
	(table) => ({
		primaryKey: primaryKey({
			columns: [table.personId, table.achievementId],
		}),
	}),
);
