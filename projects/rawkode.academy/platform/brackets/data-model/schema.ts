import { sql } from "drizzle-orm";
import {
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
	integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull();

const updatedAt = () =>
	integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => new Date())
		.notNull();

// `showId` is the tenant key: it matches a `Show` content id (e.g. "klustered").
// One show owns many seasons; everything else derives its show via its season.
export const seasons = sqliteTable(
	"seasons",
	{
		id: text("id").primaryKey(),
		showId: text("show_id").notNull(),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		status: text("status", { enum: ["interest", "active", "finished"] })
			.notNull()
			.default("interest"),
		startDate: integer("start_date", { mode: "timestamp_ms" }),
		endDate: integer("end_date", { mode: "timestamp_ms" }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [uniqueIndex("seasons_show_slug_unique").on(t.showId, t.slug)],
);

export const competitors = sqliteTable(
	"competitors",
	{
		id: text("id").primaryKey(),
		seasonId: text("season_id")
			.notNull()
			.references(() => seasons.id, { onDelete: "cascade" }),
		personSlug: text("person_slug").notNull(),
		displayName: text("display_name").notNull(),
		bio: text("bio"),
		userId: text("user_id"),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		uniqueIndex("competitors_season_person_unique").on(t.seasonId, t.personSlug),
	],
);

export const teams = sqliteTable(
	"teams",
	{
		id: text("id").primaryKey(),
		seasonId: text("season_id")
			.notNull()
			.references(() => seasons.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [uniqueIndex("teams_season_slug_unique").on(t.seasonId, t.slug)],
);

export const teamMembers = sqliteTable(
	"team_members",
	{
		teamId: text("team_id")
			.notNull()
			.references(() => teams.id, { onDelete: "cascade" }),
		competitorId: text("competitor_id")
			.notNull()
			.references(() => competitors.id, { onDelete: "cascade" }),
		role: text("role"),
		createdAt: createdAt(),
	},
	(t) => [primaryKey({ columns: [t.teamId, t.competitorId] })],
);

export const scenarios = sqliteTable("scenarios", {
	id: text("id").primaryKey(),
	slug: text("slug").notNull().unique(),
	title: text("title").notNull(),
	description: text("description").notNull(),
	difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] })
		.notNull()
		.default("medium"),
	tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
	notes: text("notes"),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

export const brackets = sqliteTable(
	"brackets",
	{
		id: text("id").primaryKey(),
		seasonId: text("season_id")
			.notNull()
			.references(() => seasons.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		kind: text("kind", { enum: ["solo", "team"] }).notNull().default("team"),
		format: text("format", { enum: ["single_elimination"] })
			.notNull()
			.default("single_elimination"),
		status: text("status", { enum: ["draft", "active", "finished"] })
			.notNull()
			.default("draft"),
		startsAt: integer("starts_at", { mode: "timestamp_ms" }),
		registrationClosesAt: integer("registration_closes_at", {
			mode: "timestamp_ms",
		}),
		maxEntries: integer("max_entries").notNull().default(16),
		cadenceDays: integer("cadence_days").notNull().default(7),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [uniqueIndex("brackets_season_slug_unique").on(t.seasonId, t.slug)],
);

export const bracketBreaks = sqliteTable("bracket_breaks", {
	id: text("id").primaryKey(),
	bracketId: text("bracket_id")
		.notNull()
		.references(() => brackets.id, { onDelete: "cascade" }),
	label: text("label").notNull(),
	startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
	endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
	createdAt: createdAt(),
});

export const bracketEntries = sqliteTable(
	"bracket_entries",
	{
		id: text("id").primaryKey(),
		bracketId: text("bracket_id")
			.notNull()
			.references(() => brackets.id, { onDelete: "cascade" }),
		competitorId: text("competitor_id").references(() => competitors.id, {
			onDelete: "cascade",
		}),
		teamId: text("team_id").references(() => teams.id, { onDelete: "cascade" }),
		displayName: text("display_name").notNull(),
		seed: integer("seed").notNull(),
		status: text("status", { enum: ["pending", "confirmed", "withdrawn"] })
			.notNull()
			.default("confirmed"),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		uniqueIndex("bracket_entries_bracket_seed_unique").on(t.bracketId, t.seed),
		uniqueIndex("bracket_entries_bracket_competitor_unique").on(
			t.bracketId,
			t.competitorId,
		),
		uniqueIndex("bracket_entries_bracket_team_unique").on(t.bracketId, t.teamId),
	],
);

export const matches = sqliteTable("matches", {
	id: text("id").primaryKey(),
	bracketId: text("bracket_id")
		.notNull()
		.references(() => brackets.id, { onDelete: "cascade" }),
	roundNumber: integer("round_number").notNull(),
	positionInRound: integer("position_in_round").notNull(),
	scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
	status: text("status", {
		enum: ["scheduled", "live", "completed", "cancelled"],
	})
		.notNull()
		.default("scheduled"),
	teamAId: text("team_a_id").references(() => teams.id, { onDelete: "set null" }),
	teamBId: text("team_b_id").references(() => teams.id, { onDelete: "set null" }),
	entryAId: text("entry_a_id").references(() => bracketEntries.id, {
		onDelete: "set null",
	}),
	entryBId: text("entry_b_id").references(() => bracketEntries.id, {
		onDelete: "set null",
	}),
	scenarioId: text("scenario_id").references(() => scenarios.id, {
		onDelete: "set null",
	}),
	judgeUserId: text("judge_user_id"),
	winnerTeamId: text("winner_team_id").references(() => teams.id, {
		onDelete: "set null",
	}),
	winnerEntryId: text("winner_entry_id").references(() => bracketEntries.id, {
		onDelete: "set null",
	}),
	startedAt: integer("started_at", { mode: "timestamp_ms" }),
	endedAt: integer("ended_at", { mode: "timestamp_ms" }),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

export const matchResults = sqliteTable("match_results", {
	id: text("id").primaryKey(),
	matchId: text("match_id")
		.notNull()
		.references(() => matches.id, { onDelete: "cascade" })
		.unique(),
	winnerTeamId: text("winner_team_id").references(() => teams.id, {
		onDelete: "set null",
	}),
	winnerEntryId: text("winner_entry_id").references(() => bracketEntries.id, {
		onDelete: "set null",
	}),
	timeToResolveSeconds: integer("time_to_resolve_seconds"),
	scoreA: integer("score_a"),
	scoreB: integer("score_b"),
	notes: text("notes"),
	recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
	recordedByUserId: text("recorded_by_user_id"),
});

export const registrations = sqliteTable("registrations", {
	id: text("id").primaryKey(),
	seasonId: text("season_id")
		.notNull()
		.references(() => seasons.id, { onDelete: "cascade" }),
	bracketId: text("bracket_id").references(() => brackets.id, {
		onDelete: "set null",
	}),
	entryType: text("entry_type", { enum: ["solo", "team"] }),
	teamName: text("team_name"),
	preferredSlot: integer("preferred_slot"),
	userId: text("user_id"),
	displayName: text("display_name").notNull(),
	email: text("email").notNull(),
	message: text("message"),
	status: text("status", { enum: ["pending", "approved", "rejected"] })
		.notNull()
		.default("pending"),
	submittedAt: integer("submitted_at", { mode: "timestamp_ms" }).notNull(),
	reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
	reviewedByUserId: text("reviewed_by_user_id"),
});
