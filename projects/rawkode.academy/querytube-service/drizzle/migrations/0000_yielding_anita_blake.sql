CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`streamed_live` integer DEFAULT false NOT NULL,
	`description` text NOT NULL,
	`date` integer NOT NULL
);
