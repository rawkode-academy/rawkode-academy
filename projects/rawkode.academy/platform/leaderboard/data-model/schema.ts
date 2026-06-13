import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const leaderboardEntriesTable = sqliteTable(
	"leaderboard_entries",
	{
		id: text("id").primaryKey(),
		namespace: text("namespace").notNull(),
		personId: text("person_id").notNull(),
		personName: text("person_name"),
		scoreType: text("score_type").notNull(),
		scoreValue: integer("score_value").notNull(),
		achievedAt: integer("achieved_at", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		boardIdx: index("leaderboard_board_idx").on(
			table.namespace,
			table.scoreType,
			table.scoreValue,
		),
		personIdx: index("leaderboard_person_idx").on(
			table.namespace,
			table.personId,
			table.scoreType,
		),
	}),
);
