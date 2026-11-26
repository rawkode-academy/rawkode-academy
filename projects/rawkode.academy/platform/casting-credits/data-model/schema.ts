import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Add a subject type or role here (and in the GraphQL enums) to support a new one.
export const CASTING_SUBJECT_TYPES = ["video", "show", "episode", "course"] as const;
export type CastingSubjectType = (typeof CASTING_SUBJECT_TYPES)[number];

export const CASTING_ROLES = ["host", "co_host", "guest", "author"] as const;
export type CastingRole = (typeof CASTING_ROLES)[number];

// Who plays which role on which subject, in credit order. subject_id is the id
// of the video, show, episode or course; a person can hold several roles on one
// subject.
export const castingCreditsTable = sqliteTable(
	"casting_credits",
	{
		subjectType: text("subject_type", { enum: CASTING_SUBJECT_TYPES }).notNull(),
		subjectId: text("subject_id").notNull(),
		personId: text("person_id").notNull(),
		role: text("role", { enum: CASTING_ROLES }).notNull(),
		position: integer("position").notNull().default(0),
	},
	(table) => [
		primaryKey({ columns: [table.subjectType, table.subjectId, table.personId, table.role] }),
		index("casting_credits_person_idx").on(table.personId),
	],
);

export type CastingCredit = typeof castingCreditsTable.$inferSelect;
