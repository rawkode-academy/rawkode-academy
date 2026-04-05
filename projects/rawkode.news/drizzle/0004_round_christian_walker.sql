CREATE TABLE `news_candidate_mentions` (
	`candidate_id` text NOT NULL,
	`source_id` text NOT NULL,
	`source_item_url` text NOT NULL,
	`source_item_id` text,
	`pulled_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`source_id`, `source_item_url`),
	FOREIGN KEY (`candidate_id`) REFERENCES `news_candidates`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `news_sources`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `news_candidate_mentions_candidate_id_idx` ON `news_candidate_mentions` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `news_candidate_mentions_source_id_idx` ON `news_candidate_mentions` (`source_id`);--> statement-breakpoint
CREATE INDEX `news_candidate_mentions_pulled_at_idx` ON `news_candidate_mentions` (`pulled_at`);--> statement-breakpoint
CREATE TABLE `news_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`normalized_url` text NOT NULL,
	`original_url` text NOT NULL,
	`title` text NOT NULL,
	`excerpt` text,
	`author_name` text,
	`published_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`converted_post_id` text,
	`latest_source_id` text,
	`latest_source_name` text,
	`latest_source_type` text,
	`first_seen_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`last_seen_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`converted_post_id`) REFERENCES `posts`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`latest_source_id`) REFERENCES `news_sources`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `news_candidates_normalized_url_idx` ON `news_candidates` (`normalized_url`);--> statement-breakpoint
CREATE INDEX `news_candidates_status_idx` ON `news_candidates` (`status`);--> statement-breakpoint
CREATE INDEX `news_candidates_last_seen_at_idx` ON `news_candidates` (`last_seen_at`);--> statement-breakpoint
CREATE INDEX `news_candidates_published_at_idx` ON `news_candidates` (`published_at`);--> statement-breakpoint
CREATE INDEX `news_candidates_latest_source_id_idx` ON `news_candidates` (`latest_source_id`);--> statement-breakpoint
CREATE TABLE `news_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`locator` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_pulled_at` integer,
	`last_pull_status` text,
	`last_pull_message` text,
	`last_pull_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `news_sources_type_locator_idx` ON `news_sources` (`type`,`locator`);--> statement-breakpoint
CREATE INDEX `news_sources_type_idx` ON `news_sources` (`type`);--> statement-breakpoint
CREATE INDEX `news_sources_enabled_idx` ON `news_sources` (`enabled`);--> statement-breakpoint
CREATE INDEX `news_sources_created_at_idx` ON `news_sources` (`created_at`);