CREATE TABLE `episodes` (
	`showId` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text NOT NULL,
	`description` text NOT NULL,
	PRIMARY KEY(`showId`, `code`)
);
