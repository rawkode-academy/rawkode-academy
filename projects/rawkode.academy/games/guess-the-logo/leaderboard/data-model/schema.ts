import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const leaderboardEntriesTable = sqliteTable(
	"leaderboard_entries",
	{
		id: text("id").primaryKey(),
		personId: text("person_id").notNull(),
		personName: text("person_name"),
		date: text("date").notNull(), // YYYY-MM-DD (UTC)
		timeMs: integer("time_ms").notNull(),
		achievedAt: integer("achieved_at", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		dateIdx: index("leaderboard_date_idx").on(table.date),
		personDateUnique: uniqueIndex("leaderboard_person_date_unique").on(
			table.personId,
			table.date,
		),
		timeIdx: index("leaderboard_time_idx").on(table.date, table.timeMs),
	}),
);
