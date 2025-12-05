CREATE TABLE `player_stats` (
	`person_id` text PRIMARY KEY NOT NULL,
	`total_wins` integer DEFAULT 0 NOT NULL,
	`total_losses` integer DEFAULT 0 NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`best_streak` integer DEFAULT 0 NOT NULL,
	`total_play_time_seconds` integer DEFAULT 0 NOT NULL,
	`enemies_defeated` integer DEFAULT 0 NOT NULL,
	`fastest_breach_seconds` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);