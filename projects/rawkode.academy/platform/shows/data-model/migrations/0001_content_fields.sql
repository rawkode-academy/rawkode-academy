ALTER TABLE `shows` ADD `description` text;--> statement-breakpoint
ALTER TABLE `shows` ADD `tagline` text;--> statement-breakpoint
ALTER TABLE `shows` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `shows` ADD `published` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `shows` ADD `game_format_url` text;--> statement-breakpoint
ALTER TABLE `shows` ADD `cover_url` text;--> statement-breakpoint
ALTER TABLE `shows` ADD `cover_alt` text;--> statement-breakpoint
ALTER TABLE `shows` ADD `podcast` text;--> statement-breakpoint
ALTER TABLE `shows` ADD `subscribe_links` text;--> statement-breakpoint
ALTER TABLE `shows` ADD `updated_at` integer;