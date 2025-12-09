CREATE TABLE `leaderboard_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`person_name` text,
	`score_type` text NOT NULL,
	`score_value` integer NOT NULL,
	`achieved_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `score_type_idx` ON `leaderboard_entries` (`score_type`);--> statement-breakpoint
CREATE INDEX `person_score_idx` ON `leaderboard_entries` (`person_id`,`score_type`);--> statement-breakpoint
CREATE INDEX `score_value_idx` ON `leaderboard_entries` (`score_type`,`score_value`);