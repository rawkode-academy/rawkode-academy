CREATE TABLE `player_achievements` (
	`person_id` text NOT NULL,
	`achievement_id` text NOT NULL,
	`unlocked_at` integer NOT NULL,
	PRIMARY KEY(`person_id`, `achievement_id`)
);
