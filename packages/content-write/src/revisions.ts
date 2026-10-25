import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Every content service keeps its own revision log, in its own D1, so a row
// change and its revision commit in one batch. Re-export this table from the
// service's data-model/schema.ts so drizzle-kit generates its migration.
//
// The unique (model, entity_id, version) index is the concurrency guard: two
// writers that both read version 4 both try to insert version 5, and the
// second batch fails as a whole.
export const contentRevisions = sqliteTable(
	"content_revisions",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		model: text("model").notNull(),
		entityId: text("entity_id").notNull(),
		version: integer("version").notNull(),
		operation: text("operation", {
			enum: ["create", "update", "delete", "restore", "set"],
		}).notNull(),
		actorId: text("actor_id").notNull(),
		actorKind: text("actor_kind", { enum: ["user", "agent"] }).notNull(),
		actorName: text("actor_name"),
		snapshot: text("snapshot", { mode: "json" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("content_revisions_entity_version_idx").on(
			table.model,
			table.entityId,
			table.version,
		),
		index("content_revisions_created_at_idx").on(table.createdAt),
	],
);

export type ContentRevision = typeof contentRevisions.$inferSelect;
