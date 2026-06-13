CREATE TABLE `player_stats` (
	`namespace` text NOT NULL,
	`person_id` text NOT NULL,
	`stats` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`namespace`, `person_id`)
);
