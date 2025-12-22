import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

export const watchHistoryTable = sqliteTable(
	"watch_history",
	{
		userId: text("user_id").notNull(),
		videoId: text("video_id").notNull(),
		positionSeconds: integer("position_seconds").notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		primaryKey: primaryKey({
			columns: [table.userId, table.videoId],
		}),
	}),
);
