CREATE TABLE `content_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model` text NOT NULL,
	`entity_id` text NOT NULL,
	`version` integer NOT NULL,
	`operation` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_kind` text NOT NULL,
	`actor_name` text,
	`snapshot` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_revisions_entity_version_idx` ON `content_revisions` (`model`,`entity_id`,`version`);--> statement-breakpoint
CREATE INDEX `content_revisions_created_at_idx` ON `content_revisions` (`created_at`);