CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subtitle` text NOT NULL,
	`slug` text NOT NULL,
	`description` text NOT NULL,
	`duration` integer NOT NULL,
	`publishedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `videos_slug_unique` ON `videos` (`slug`);