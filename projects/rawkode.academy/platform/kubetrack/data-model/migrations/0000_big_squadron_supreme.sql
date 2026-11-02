CREATE TABLE `release_features` (
	`id` text PRIMARY KEY NOT NULL,
	`release_id` text NOT NULL,
	`slug` text NOT NULL,
	`kep` integer NOT NULL,
	`title` text NOT NULL,
	`stage` text NOT NULL,
	`sig` text,
	`theme` text,
	`feature_gate` text,
	`enabled_by_default` integer,
	`previous_stage` text,
	`previous_stage_version` text,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`example` text,
	`docs_url` text,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`release_id`) REFERENCES `releases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `release_features_release_slug_unique` ON `release_features` (`release_id`,`slug`);--> statement-breakpoint
CREATE TABLE `quiz_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`release_id` text NOT NULL,
	`feature_id` text,
	`kind` text NOT NULL,
	`prompt` text NOT NULL,
	`choices` text NOT NULL,
	`answer_ids` text NOT NULL,
	`explanation` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`release_id`) REFERENCES `releases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`feature_id`) REFERENCES `release_features`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `releases` (
	`id` text PRIMARY KEY NOT NULL,
	`major` integer NOT NULL,
	`minor` integer NOT NULL,
	`title` text NOT NULL,
	`codename` text,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`released_at` integer NOT NULL,
	`published_at` integer NOT NULL,
	`release_blog_url` text,
	`changelog_url` text,
	`upstream_counts` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `releases_version_idx` ON `releases` (`major`,`minor`);