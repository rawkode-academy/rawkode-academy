CREATE TABLE `player_learned_comebacks` (
	`person_id` text NOT NULL,
	`comeback_id` text NOT NULL,
	`learned_at` integer NOT NULL,
	PRIMARY KEY(`person_id`, `comeback_id`)
);
--> statement-breakpoint
CREATE TABLE `player_learned_insults` (
	`person_id` text NOT NULL,
	`insult_id` text NOT NULL,
	`learned_at` integer NOT NULL,
	PRIMARY KEY(`person_id`, `insult_id`)
);