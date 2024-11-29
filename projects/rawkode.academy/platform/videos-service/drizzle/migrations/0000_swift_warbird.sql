CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`show` text,
	`type` text NOT NULL,
	`visibility` text NOT NULL,
	`published_at` text NOT NULL,
	`duration` integer NOT NULL,
	`chapters` text
);
