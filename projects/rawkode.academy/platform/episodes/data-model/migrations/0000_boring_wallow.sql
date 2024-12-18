CREATE TABLE `episodes` (
	`videoId` text PRIMARY KEY NOT NULL,
	`showId` text NOT NULL,
	`code` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `showCode` ON `episodes` (`showId`,`code`);