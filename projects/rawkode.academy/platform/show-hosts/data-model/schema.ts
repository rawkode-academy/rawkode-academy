import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Which people host which shows, in billing order.
export const showHostsTable = sqliteTable(
	"show_hosts",
	{
		showId: text("show_id").notNull(),
		hostId: text("host_id").notNull(),
		position: integer("position").notNull().default(0),
	},
	(table) => [primaryKey({ columns: [table.hostId, table.showId] })],
);

// Revision log for the write model (see packages/content-write).
export { contentRevisions } from "@rawkodeacademy/content-write/revisions";
