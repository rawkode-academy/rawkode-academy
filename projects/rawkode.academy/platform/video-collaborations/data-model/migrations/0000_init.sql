CREATE TABLE `collaborators` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`website_url` text NOT NULL,
	`logo_url` text,
	`organization_id` text
);
--> statement-breakpoint
CREATE TABLE `video_collaborations` (
	`video_id` text NOT NULL,
	`collaborator_id` text NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`cta_link` text,
	PRIMARY KEY(`video_id`, `collaborator_id`),
	FOREIGN KEY (`collaborator_id`) REFERENCES `collaborators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `video_collaborations_collaborator_idx` ON `video_collaborations` (`collaborator_id`);