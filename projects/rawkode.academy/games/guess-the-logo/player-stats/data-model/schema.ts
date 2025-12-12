import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const dailyChallengesTable = sqliteTable(
	"daily_challenges",
	{
		date: text("date").primaryKey(),
		techIdsJson: text("tech_ids_json").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		createdAtIdx: index("daily_challenges_created_at_idx").on(table.createdAt),
	}),
);

export const attemptsTable = sqliteTable(
	"attempts",
	{
		id: text("id").primaryKey(),
		personId: text("person_id").notNull(),
		date: text("date").notNull(),
		status: text("status").notNull(), // playing | completed | out_of_lives
		currentIndex: integer("current_index").notNull().default(0),
		livesRemaining: integer("lives_remaining").notNull().default(5),
		wrongGuesses: integer("wrong_guesses").notNull().default(0),
		startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
		finishedAt: integer("finished_at", { mode: "timestamp" }),
		finalTimeMs: integer("final_time_ms"),
		updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		personDateUnique: uniqueIndex("attempts_person_date_unique").on(
			table.personId,
			table.date,
		),
		personDateIdx: index("attempts_person_date_idx").on(
			table.personId,
			table.date,
		),
		dateIdx: index("attempts_date_idx").on(table.date),
	}),
);

export const dailyActivityTable = sqliteTable(
	"daily_activity",
	{
		id: text("id").primaryKey(),
		personId: text("person_id").notNull(),
		date: text("date").notNull(),
		logosCorrect: integer("logos_correct").notNull().default(0),
		livesUsed: integer("lives_used").notNull().default(0),
		completed: integer("completed").notNull().default(0),
		bestTimeMs: integer("best_time_ms"),
		updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		personDateUnique: uniqueIndex("daily_activity_person_date_unique").on(
			table.personId,
			table.date,
		),
		personDateIdx: index("daily_activity_person_date_idx").on(
			table.personId,
			table.date,
		),
		dateIdx: index("daily_activity_date_idx").on(table.date),
	}),
);
