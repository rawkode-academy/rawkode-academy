import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const castingCreditsTable = sqliteTable(
	"casting-credits",
	{
		personId: text("person_id").notNull(),
		role: text("role").notNull(),
		videoId: text("video_id").notNull(),
	},
	(table) => ({
		primaryKey: primaryKey({
			columns: [table.personId, table.role, table.videoId],
		}),
	}),
);
