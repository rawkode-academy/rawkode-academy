CREATE TABLE `transcription_terms` (
	`foreignId` text NOT NULL,
	`term` text NOT NULL,
	PRIMARY KEY(`foreignId`, `term`)
);
