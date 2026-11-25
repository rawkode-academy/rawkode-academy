import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// A company the Academy makes videos with. The id is a slug such as "datum".
// organization_id is the identity organisation its staff belong to, once one exists.
export const collaboratorsTable = sqliteTable("collaborators", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	websiteUrl: text("website_url").notNull(),
	logoUrl: text("logo_url"),
	organizationId: text("organization_id"),
});

export type Collaborator = typeof collaboratorsTable.$inferSelect;

// A video made with a collaborator. A null start or end leaves that side open.
// cta_link is the tracked link used in the video; it is never exposed over GraphQL.
export const videoCollaborationsTable = sqliteTable(
	"video_collaborations",
	{
		videoId: text("video_id").notNull(),
		collaboratorId: text("collaborator_id")
			.notNull()
			.references(() => collaboratorsTable.id, { onDelete: "cascade" }),
		startsAt: integer("starts_at", { mode: "timestamp" }),
		endsAt: integer("ends_at", { mode: "timestamp" }),
		ctaLink: text("cta_link"),
	},
	(table) => [
		primaryKey({ columns: [table.videoId, table.collaboratorId] }),
		index("video_collaborations_collaborator_idx").on(table.collaboratorId),
	],
);
