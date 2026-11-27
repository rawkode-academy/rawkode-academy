import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// A draft video a collaborator reviews. organization_id is the identity
// organisation whose members may see it; collaborator_id is the company.
export const reviewsTable = sqliteTable(
	"reviews",
	{
		id: text("id").primaryKey(),
		collaboratorId: text("collaborator_id").notNull(),
		organizationId: text("organization_id").notNull(),
		videoId: text("video_id").notNull(),
		title: text("title").notNull(),
		videoUrl: text("video_url").notNull(),
		state: text("state", {
			enum: ["in_review", "changes_requested", "approved", "scheduled", "published"],
		})
			.notNull()
			.default("in_review"),
		draftVersion: integer("draft_version").notNull().default(1),
		dueAt: integer("due_at", { mode: "timestamp" }).notNull(),
		partnerApprovedBy: text("partner_approved_by"),
		partnerApprovedAt: integer("partner_approved_at", { mode: "timestamp" }),
		scheduledFor: integer("scheduled_for", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	},
	(table) => [
		index("reviews_collaborator_idx").on(table.collaboratorId),
		index("reviews_organization_idx").on(table.organizationId),
	],
);

export const reviewCommentsTable = sqliteTable(
	"review_comments",
	{
		id: text("id").primaryKey(),
		reviewId: text("review_id")
			.notNull()
			.references(() => reviewsTable.id, { onDelete: "cascade" }),
		draftVersion: integer("draft_version").notNull(),
		authorId: text("author_id").notNull(),
		authorLogin: text("author_login").notNull(),
		authorSide: text("author_side", { enum: ["partner", "staff"] }).notNull(),
		// Null for a general note.
		timestampMs: integer("timestamp_ms"),
		body: text("body").notNull(),
		triage: text("triage", {
			enum: ["new", "actionable", "not_actionable", "fixed", "withdrawn"],
		})
			.notNull()
			.default("new"),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	},
	(table) => [index("review_comments_review_idx").on(table.reviewId)],
);

export type Review = typeof reviewsTable.$inferSelect;
export type ReviewComment = typeof reviewCommentsTable.$inferSelect;
