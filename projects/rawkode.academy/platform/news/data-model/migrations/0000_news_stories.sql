CREATE TABLE `news_authors` (
	`story_id` text NOT NULL,
	`person_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`story_id`, `person_id`)
);
--> statement-breakpoint
CREATE INDEX `news_authors_person_id_idx` ON `news_authors` (`person_id`);--> statement-breakpoint
CREATE TABLE `news_stories` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`body` text NOT NULL,
	`published_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `news_stories_published_at_idx` ON `news_stories` (`published_at`);--> statement-breakpoint
CREATE TABLE `news_technologies` (
	`story_id` text NOT NULL,
	`technology_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`story_id`, `technology_id`)
);
--> statement-breakpoint
CREATE INDEX `news_technologies_technology_id_idx` ON `news_technologies` (`technology_id`);