import { sql } from "drizzle-orm";
import {
	integer,
	sqliteTable,
	primaryKey,
	text,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-typebox";

export const rsvpTable = sqliteTable(
	"rsvp",
	{
		userId: text("userId").notNull(),
		eventId: text("eventId").notNull(),
		createdAt: integer("createdAt", { mode: "timestamp" })
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
	},
	(rsvps) => ({
		primaryKey: primaryKey({
			name: "rsvp_primary_key",
			columns: [rsvps.userId, rsvps.eventId],
		}),
	}),
);

export const rsvpInsertSchema = createInsertSchema(rsvpTable);
export const rsvpSelectSchema = createSelectSchema(rsvpTable);
