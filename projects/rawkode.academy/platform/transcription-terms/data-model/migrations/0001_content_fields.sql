PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transcription_terms` (
	`kind` text DEFAULT 'technology' NOT NULL,
	`foreignId` text NOT NULL,
	`term` text NOT NULL,
	PRIMARY KEY(`kind`, `foreignId`, `term`)
);
--> statement-breakpoint
INSERT INTO `__new_transcription_terms`("kind", "foreignId", "term") SELECT 'technology', "foreignId", "term" FROM `transcription_terms`;--> statement-breakpoint
DROP TABLE `transcription_terms`;--> statement-breakpoint
ALTER TABLE `__new_transcription_terms` RENAME TO `transcription_terms`;--> statement-breakpoint
PRAGMA foreign_keys=ON;