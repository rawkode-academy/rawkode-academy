PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `brackets_new` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`kind` text DEFAULT 'team' NOT NULL,
	`format` text DEFAULT 'single_elimination' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`starts_at` integer NOT NULL,
	`registration_closes_at` integer,
	`max_entries` integer DEFAULT 16 NOT NULL,
	`team_size` integer DEFAULT 4 NOT NULL,
	`cadence_days` integer DEFAULT 7 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `brackets_new` (
	`id`,
	`season_id`,
	`name`,
	`slug`,
	`kind`,
	`format`,
	`status`,
	`starts_at`,
	`registration_closes_at`,
	`max_entries`,
	`team_size`,
	`cadence_days`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`season_id`,
	`name`,
	`slug`,
	`kind`,
	`format`,
	`status`,
	COALESCE(
		`starts_at`,
		(
			SELECT `start_date`
			FROM `seasons`
			WHERE `seasons`.`id` = `brackets`.`season_id`
		),
		`created_at`
	),
	`registration_closes_at`,
	`max_entries`,
	CASE
		WHEN `kind` = 'team' AND `team_size` = 2 AND `status` != 'finished' THEN 4
		ELSE `team_size`
	END,
	`cadence_days`,
	`created_at`,
	`updated_at`
FROM `brackets`;
--> statement-breakpoint
DROP TABLE `brackets`;
--> statement-breakpoint
ALTER TABLE `brackets_new` RENAME TO `brackets`;
--> statement-breakpoint
CREATE UNIQUE INDEX `brackets_season_slug_unique` ON `brackets` (`season_id`,`slug`);
--> statement-breakpoint
CREATE TABLE `matches_new` (
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
	FOREIGN KEY (`winner_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`winner_entry_id`) REFERENCES `bracket_entries`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `matches_new` (
	`id`,
	`bracket_id`,
	`round_number`,
	`position_in_round`,
	`scheduled_at`,
	`status`,
	`team_a_id`,
	`team_b_id`,
	`entry_a_id`,
	`entry_b_id`,
	`judge_user_id`,
	`winner_team_id`,
	`winner_entry_id`,
	`started_at`,
	`ended_at`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`bracket_id`,
	`round_number`,
	`position_in_round`,
	`scheduled_at`,
	`status`,
	`team_a_id`,
	`team_b_id`,
	`entry_a_id`,
	`entry_b_id`,
	`judge_user_id`,
	`winner_team_id`,
	`winner_entry_id`,
	`started_at`,
	`ended_at`,
	`created_at`,
	`updated_at`
FROM `matches`;
--> statement-breakpoint
DROP TABLE `matches`;
--> statement-breakpoint
ALTER TABLE `matches_new` RENAME TO `matches`;
--> statement-breakpoint
DROP TABLE `scenarios`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
