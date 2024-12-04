CREATE TABLE `technologies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`logoUrl` text,
	`description` text NOT NULL,
	`website` text,
	`documentation` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `technologies_name_unique` ON `technologies` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `technologies_logoUrl_unique` ON `technologies` (`logoUrl`);