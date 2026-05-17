CREATE TABLE `brackets` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`format` text DEFAULT 'single_elimination' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brackets_season_slug_unique` ON `brackets` (`season_id`,`slug`);--> statement-breakpoint
CREATE TABLE `competitors` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`person_slug` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competitors_season_person_unique` ON `competitors` (`season_id`,`person_slug`);--> statement-breakpoint
CREATE TABLE `match_results` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`winner_team_id` text,
	`time_to_resolve_seconds` integer,
	`score_a` integer,
	`score_b` integer,
	`notes` text,
	`recorded_at` integer NOT NULL,
	`recorded_by_user_id` text,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`winner_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_results_match_id_unique` ON `match_results` (`match_id`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`bracket_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`position_in_round` integer NOT NULL,
	`scheduled_at` integer,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`team_a_id` text,
	`team_b_id` text,
	`scenario_id` text,
	`judge_user_id` text,
	`winner_team_id` text,
	`started_at` integer,
	`ended_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`bracket_id`) REFERENCES `brackets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_a_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`team_b_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`winner_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`user_id` text,
	`display_name` text NOT NULL,
	`email` text NOT NULL,
	`message` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`submitted_at` integer NOT NULL,
	`reviewed_at` integer,
	`reviewed_by_user_id` text,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`difficulty` text DEFAULT 'medium' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scenarios_slug_unique` ON `scenarios` (`slug`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'interest' NOT NULL,
	`start_date` integer,
	`end_date` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seasons_slug_unique` ON `seasons` (`slug`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`team_id` text NOT NULL,
	`competitor_id` text NOT NULL,
	`role` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`team_id`, `competitor_id`),
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`competitor_id`) REFERENCES `competitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_season_slug_unique` ON `teams` (`season_id`,`slug`);