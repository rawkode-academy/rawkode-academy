import { createId } from "@paralleldrive/cuid2";
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

export const emailPreferencesTable = sqliteTable(
	"email_preferences",
	{
		userId: text("user_id").notNull(),
		channel: text("channel").notNull(),
		audience: text("audience").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		pk: primaryKey({
			columns: [table.userId, table.channel, table.audience],
		}),
		userIdx: index("email_preferences_user_idx").on(table.userId),
	}),
);

export const emailPreferenceEventsTable = sqliteTable(
	"email_preference_events",
	{
		id: text("id").notNull().$defaultFn(createId).primaryKey(),
		userId: text("user_id").notNull(),
		channel: text("channel").notNull(),
		audience: text("audience").notNull(),
		action: text("action").notNull(), // "subscribed" or "unsubscribed"
		occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		userIdx: index("email_pref_events_user_idx").on(table.userId),
		audienceIdx: index("email_pref_events_audience_idx").on(
			table.audience,
		),
	}),
);
