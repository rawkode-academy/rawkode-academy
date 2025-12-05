CREATE TABLE `daily_challenge_completions` (
	`challenge_id` text NOT NULL,
	`person_id` text NOT NULL,
	`completed_at` integer NOT NULL,
	`move_count` integer NOT NULL,
	`time_seconds` integer NOT NULL,
	PRIMARY KEY(`challenge_id`, `person_id`)
);
--> statement-breakpoint
CREATE INDEX `challenge_idx` ON `daily_challenge_completions` (`challenge_id`);--> statement-breakpoint
CREATE TABLE `daily_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`enemy_id` text NOT NULL,
	`allowed_comebacks` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_challenges_date_unique` ON `daily_challenges` (`date`);--> statement-breakpoint
CREATE INDEX `date_idx` ON `daily_challenges` (`date`);