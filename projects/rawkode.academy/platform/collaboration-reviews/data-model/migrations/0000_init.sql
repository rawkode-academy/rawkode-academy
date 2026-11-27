CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`collaborator_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`video_id` text NOT NULL,
	`title` text NOT NULL,
	`video_url` text NOT NULL,
	`state` text DEFAULT 'in_review' NOT NULL,
	`draft_version` integer DEFAULT 1 NOT NULL,
	`due_at` integer NOT NULL,
	`partner_approved_by` text,
	`partner_approved_at` integer,
	`scheduled_for` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reviews_collaborator_idx` ON `reviews` (`collaborator_id`);
--> statement-breakpoint
CREATE INDEX `reviews_organization_idx` ON `reviews` (`organization_id`);
--> statement-breakpoint
CREATE TABLE `review_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`draft_version` integer NOT NULL,
	`author_id` text NOT NULL,
	`author_login` text NOT NULL,
	`author_side` text NOT NULL,
	`timestamp_ms` integer,
	`body` text NOT NULL,
	`triage` text DEFAULT 'new' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `review_comments_review_idx` ON `review_comments` (`review_id`);
