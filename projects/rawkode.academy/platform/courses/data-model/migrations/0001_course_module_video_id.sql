ALTER TABLE `course_modules` ADD `video_id` text;--> statement-breakpoint
UPDATE `course_modules` SET `video_id` = json_extract(`video`, '$.id') WHERE `video` IS NOT NULL;
