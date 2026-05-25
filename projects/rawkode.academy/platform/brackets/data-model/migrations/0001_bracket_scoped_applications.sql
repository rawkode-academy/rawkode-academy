ALTER TABLE `brackets` ADD `team_size` integer DEFAULT 2 NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `competitors_season_user_unique` ON `competitors` (`season_id`,`user_id`) WHERE `user_id` is not null;
--> statement-breakpoint
DROP TABLE `match_results`;
--> statement-breakpoint
DROP TABLE `matches`;
--> statement-breakpoint
DROP TABLE `bracket_entries`;
--> statement-breakpoint
DROP TABLE `team_members`;
--> statement-breakpoint
DROP TABLE `teams`;
--> statement-breakpoint
CREATE TABLE `bracket_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`bracket_id` text NOT NULL,
	`competitor_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`bracket_id`) REFERENCES `brackets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`competitor_id`) REFERENCES `competitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bracket_applications_bracket_competitor_unique` ON `bracket_applications` (`bracket_id`,`competitor_id`);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`bracket_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bracket_id`) REFERENCES `brackets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_bracket_slug_unique` ON `teams` (`bracket_id`,`slug`);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`team_id` text NOT NULL,
	`bracket_id` text NOT NULL,
	`competitor_id` text NOT NULL,
	`role` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`team_id`, `competitor_id`),
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bracket_id`) REFERENCES `brackets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`competitor_id`) REFERENCES `competitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_bracket_competitor_unique` ON `team_members` (`bracket_id`,`competitor_id`);
--> statement-breakpoint
CREATE TABLE `team_invites` (
	`token` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`bracket_id` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bracket_id`) REFERENCES `brackets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bracket_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`bracket_id` text NOT NULL,
	`competitor_id` text,
	`team_id` text,
	`display_name` text NOT NULL,
	`seed` integer NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`bracket_id`) REFERENCES `brackets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`competitor_id`) REFERENCES `competitors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bracket_entries_bracket_seed_unique` ON `bracket_entries` (`bracket_id`,`seed`);
--> statement-breakpoint
CREATE UNIQUE INDEX `bracket_entries_bracket_competitor_unique` ON `bracket_entries` (`bracket_id`,`competitor_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `bracket_entries_bracket_team_unique` ON `bracket_entries` (`bracket_id`,`team_id`);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`bracket_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`position_in_round` integer NOT NULL,
	`scheduled_at` integer,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`team_a_id` text,
	`team_b_id` text,
	`entry_a_id` text,
	`entry_b_id` text,
	`scenario_id` text,
	`judge_user_id` text,
	`winner_team_id` text,
	`winner_entry_id` text,
	`started_at` integer,
	`ended_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`bracket_id`) REFERENCES `brackets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_a_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`team_b_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`entry_a_id`) REFERENCES `bracket_entries`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`entry_b_id`) REFERENCES `bracket_entries`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`winner_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`winner_entry_id`) REFERENCES `bracket_entries`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `match_results` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`winner_team_id` text,
	`winner_entry_id` text,
	`time_to_resolve_seconds` integer,
	`score_a` integer,
	`score_b` integer,
	`notes` text,
	`recorded_at` integer NOT NULL,
	`recorded_by_user_id` text,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`winner_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`winner_entry_id`) REFERENCES `bracket_entries`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_results_match_id_unique` ON `match_results` (`match_id`);
