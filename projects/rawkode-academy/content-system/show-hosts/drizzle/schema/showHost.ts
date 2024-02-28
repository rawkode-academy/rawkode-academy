import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const showHostsTable = sqliteTable(
	"show_hosts",
	{
		showId: text("show_id").notNull(),
		hostId: text("host_id").notNull(),
	},
	(table) => ({
		primaryKey: primaryKey({
			columns: [table.showId, table.hostId],
		}),
	})
);
