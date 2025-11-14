-- Migration: Add legacy_identity table for Zitadel to Better Auth identity mapping
-- This table maps old Zitadel subject IDs to new Better Auth user IDs
-- to maintain continuity across the authentication migration

CREATE TABLE `legacy_identity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`legacy_provider` text NOT NULL,
	`legacy_subject` text NOT NULL,
	`migrated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legacy_identity_provider_subject_unique` ON `legacy_identity` (`legacy_provider`, `legacy_subject`);
