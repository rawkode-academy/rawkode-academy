CREATE TABLE `supporter_technologies` (
	`supporter_id` text NOT NULL,
	`technology_id` text NOT NULL,
	PRIMARY KEY(`supporter_id`, `technology_id`),
	FOREIGN KEY (`supporter_id`) REFERENCES `supporters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supporter_technologies_technology_idx` ON `supporter_technologies` (`technology_id`);--> statement-breakpoint
CREATE TABLE `supporters` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`website_url` text NOT NULL,
	`logo_url` text,
	`started_at` integer NOT NULL,
	`ended_at` integer
);
