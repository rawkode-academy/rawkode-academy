CREATE TABLE `leaderboard_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace` text NOT NULL,
	`person_id` text NOT NULL,
	`person_name` text,
	`score_type` text NOT NULL,
	`score_value` integer NOT NULL,
	`achieved_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `leaderboard_board_idx` ON `leaderboard_entries` (`namespace`,`score_type`,`score_value`);--> statement-breakpoint
CREATE INDEX `leaderboard_person_idx` ON `leaderboard_entries` (`namespace`,`person_id`,`score_type`);