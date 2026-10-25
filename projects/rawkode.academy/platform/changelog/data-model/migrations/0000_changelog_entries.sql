CREATE TABLE `changelog_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`date` integer NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`pull_request` integer,
	`author_id` text NOT NULL,
	`body` text,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `changelog_entries_date_idx` ON `changelog_entries` (`date`);