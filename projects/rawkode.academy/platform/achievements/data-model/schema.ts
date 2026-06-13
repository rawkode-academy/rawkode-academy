import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const playerAchievementsTable = sqliteTable(
	"player_achievements",
	{
		namespace: text("namespace").notNull(),
		personId: text("person_id").notNull(),
		achievementId: text("achievement_id").notNull(),
		unlockedAt: integer("unlocked_at", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		pk: primaryKey({
			columns: [table.namespace, table.personId, table.achievementId],
		}),
	}),
);
