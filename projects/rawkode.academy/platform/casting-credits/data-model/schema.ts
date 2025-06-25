import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const RoleTypes = ["guest", "host"] as const;

export const castingCreditsTable = sqliteTable(
	"casting_credits",
	{
		personId: text("person_id").notNull(),
		role: text({ enum: RoleTypes }).notNull(),
		videoId: text("video_id").notNull(),
	},
	(table) => ({
		primaryKey: primaryKey({
			columns: [table.personId, table.role, table.videoId],
		}),
	}),
);
