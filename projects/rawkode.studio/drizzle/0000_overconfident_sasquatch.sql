CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_sid` text NOT NULL,
	`participant_identity` text NOT NULL,
	`participant_name` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_sid`) REFERENCES `livestreams`(`sid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `livestreams` (
	`sid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`ended_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `livestreams_name_unique` ON `livestreams` (`name`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_sid` text NOT NULL,
	`identity` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`room_sid`) REFERENCES `livestreams`(`sid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_room_sid_identity_unique` ON `participants` (`room_sid`,`identity`);