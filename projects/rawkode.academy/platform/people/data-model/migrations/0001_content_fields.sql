ALTER TABLE `people` ADD `name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `people` ADD `github` text;--> statement-breakpoint
ALTER TABLE `people` ADD `twitter` text;--> statement-breakpoint
ALTER TABLE `people` ADD `bluesky` text;--> statement-breakpoint
ALTER TABLE `people` ADD `linkedin` text;--> statement-breakpoint
ALTER TABLE `people` ADD `mastodon` text;--> statement-breakpoint
ALTER TABLE `people` ADD `website` text;--> statement-breakpoint
ALTER TABLE `people` ADD `youtube` text;--> statement-breakpoint
ALTER TABLE `people` ADD `updated_at` integer;