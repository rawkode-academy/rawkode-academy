CREATE TABLE `episodes` (
	`showId` text NOT NULL,
	`code` text NOT NULL,
	`contentId` text NOT NULL,
	PRIMARY KEY(`showId`, `code`)
);
