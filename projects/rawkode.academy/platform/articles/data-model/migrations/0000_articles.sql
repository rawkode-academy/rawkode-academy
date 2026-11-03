CREATE TABLE `article_authors` (
	`article_id` text NOT NULL,
	`person_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`article_id`, `person_id`)
);
--> statement-breakpoint
CREATE INDEX `article_authors_person_id_idx` ON `article_authors` (`person_id`);--> statement-breakpoint
CREATE TABLE `article_technologies` (
	`article_id` text NOT NULL,
	`technology_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`article_id`, `technology_id`)
);
--> statement-breakpoint
CREATE INDEX `article_technologies_technology_id_idx` ON `article_technologies` (`technology_id`);--> statement-breakpoint
CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`description` text NOT NULL,
	`body` text NOT NULL,
	`type` text NOT NULL,
	`howto` integer DEFAULT false NOT NULL,
	`draft` integer DEFAULT false NOT NULL,
	`series` text,
	`categories` text NOT NULL,
	`tags` text NOT NULL,
	`cover_url` text,
	`cover_alt` text,
	`cover_width` integer,
	`cover_height` integer,
	`open_graph_title` text,
	`open_graph_subtitle` text,
	`updates` text NOT NULL,
	`resources` text NOT NULL,
	`published_at` integer NOT NULL,
	`revised_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `articles_published_at_idx` ON `articles` (`published_at`);