ALTER TABLE `technologies` ADD `source` text;--> statement-breakpoint
ALTER TABLE `technologies` ADD `license` text DEFAULT 'Unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `technologies` ADD `status` text DEFAULT 'stable' NOT NULL;--> statement-breakpoint
ALTER TABLE `technologies` ADD `category` text;--> statement-breakpoint
ALTER TABLE `technologies` ADD `subcategory` text;--> statement-breakpoint
ALTER TABLE `technologies` ADD `aliases` text;--> statement-breakpoint
ALTER TABLE `technologies` ADD `related_technologies` text;--> statement-breakpoint
ALTER TABLE `technologies` ADD `use_cases` text;--> statement-breakpoint
ALTER TABLE `technologies` ADD `features` text;--> statement-breakpoint
ALTER TABLE `technologies` ADD `learning_resources` text;--> statement-breakpoint
ALTER TABLE `technologies` ADD `logos` text;--> statement-breakpoint
ALTER TABLE `technologies` ADD `cncf` text;--> statement-breakpoint
ALTER TABLE `technologies` ADD `community` text;--> statement-breakpoint
ALTER TABLE `technologies` ADD `matrix` text;--> statement-breakpoint
ALTER TABLE `technologies` ADD `seo` text;--> statement-breakpoint
ALTER TABLE `technologies` ADD `updated_at` integer;