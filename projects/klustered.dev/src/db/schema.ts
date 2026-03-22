import {
	sqliteTable,
	text,
	integer,
	index,
} from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

export const brackets = sqliteTable("brackets", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => createId()),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	description: text("description"),
	type: text("type", { enum: ["solo", "team"] }).notNull(),
	status: text("status", {
		enum: ["draft", "registration", "active", "completed"],
	})
		.notNull()
		.default("draft"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	startedAt: integer("started_at", { mode: "timestamp" }),
	completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const competitors = sqliteTable(
	"competitors",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => createId()),
		bracketId: text("bracket_id")
			.notNull()
			.references(() => brackets.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		displayName: text("display_name"),
		imageUrl: text("image_url"),
		seed: integer("seed"),
		userId: text("user_id"),
		confirmed: integer("confirmed", { mode: "boolean" }).notNull().default(false),
		confirmedAt: integer("confirmed_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		index("competitors_bracket_idx").on(table.bracketId),
		index("competitors_user_bracket_idx").on(table.userId, table.bracketId),
	],
);

export const matches = sqliteTable(
	"matches",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => createId()),
		bracketId: text("bracket_id")
			.notNull()
			.references(() => brackets.id, { onDelete: "cascade" }),
		round: integer("round").notNull(),
		position: integer("position").notNull(),
		competitor1Id: text("competitor1_id").references(() => competitors.id),
		competitor2Id: text("competitor2_id").references(() => competitors.id),
		winnerId: text("winner_id").references(() => competitors.id),
		status: text("status", {
			enum: ["pending", "scheduled", "live", "completed"],
		})
			.notNull()
			.default("pending"),
		scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
		streamUrl: text("stream_url"),
		vodUrl: text("vod_url"),
		notes: text("notes"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		completedAt: integer("completed_at", { mode: "timestamp" }),
	},
	(table) => [
		index("matches_bracket_idx").on(table.bracketId),
		index("matches_round_idx").on(table.bracketId, table.round),
	],
);

export type Bracket = typeof brackets.$inferSelect;
export type NewBracket = typeof brackets.$inferInsert;
export type Competitor = typeof competitors.$inferSelect;
export type NewCompetitor = typeof competitors.$inferInsert;
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
