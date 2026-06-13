CREATE TABLE `player_achievements` (
	`namespace` text NOT NULL,
	`person_id` text NOT NULL,
	`achievement_id` text NOT NULL,
	`unlocked_at` integer NOT NULL,
	PRIMARY KEY(`namespace`, `person_id`, `achievement_id`)
);
