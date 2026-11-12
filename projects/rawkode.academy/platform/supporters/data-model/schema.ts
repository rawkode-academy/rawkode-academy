import {
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

// A supporter is active from started_at until ended_at (open-ended when null).
export const supportersTable = sqliteTable("supporters", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	websiteUrl: text("website_url").notNull(),
	logoUrl: text("logo_url"),
	startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
	endedAt: integer("ended_at", { mode: "timestamp" }),
});

export type Supporter = typeof supportersTable.$inferSelect;

// The technologies a supporter sponsors. A technology has at most one supporter.
export const supporterTechnologiesTable = sqliteTable(
	"supporter_technologies",
	{
		supporterId: text("supporter_id")
			.notNull()
			.references(() => supportersTable.id, { onDelete: "cascade" }),
		technologyId: text("technology_id").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.supporterId, table.technologyId] }),
		uniqueIndex("supporter_technologies_technology_idx").on(table.technologyId),
	],
);
