CREATE TABLE `rsvp` (
	`userId` text NOT NULL,
	`eventId` text NOT NULL,
	`createdAt` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`eventId`, `userId`)
);
