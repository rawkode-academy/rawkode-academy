CREATE TABLE `casting_credits` (
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`person_id` text NOT NULL,
	`role` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`subject_type`, `subject_id`, `person_id`, `role`)
);
--> statement-breakpoint
CREATE INDEX `casting_credits_person_idx` ON `casting_credits` (`person_id`);