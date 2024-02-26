import { sql } from "drizzle-orm";
import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-typebox";

export const rsvpTable = sqliteTable(
	"rsvp",
	{
		userId: text("user_id").notNull(),
		eventId: text("event_id").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`current_timestamp`),
	},
	(rsvps) => ({
		primaryKey: primaryKey({
			name: "rsvp_primary_key",
			columns: [rsvps.userId, rsvps.eventId],
		}),
	})
);

export const rsvpInsertSchema = createInsertSchema(rsvpTable);
export const rsvpSelectSchema = createSelectSchema(rsvpTable);
