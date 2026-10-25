CREATE TABLE `adrs` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`adopted_at` integer NOT NULL,
	`body` text NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `adr_authors` (
	`adr_id` text NOT NULL,
	`person_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`adr_id`, `person_id`)
);
