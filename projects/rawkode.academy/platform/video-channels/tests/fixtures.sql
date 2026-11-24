-- A small slice of the real mapping, in migration format.
INSERT INTO `video_channels` (`video_id`, `platform`, `external_id`) VALUES ('v1', 'youtube', 'dQw4w9WgXcQ')
--> statement-breakpoint
INSERT INTO `video_channels` (`video_id`, `platform`, `external_id`) VALUES ('v1', 'x', '1234567890')
--> statement-breakpoint
INSERT INTO `video_channels` (`video_id`, `platform`, `external_id`) VALUES ('v2', 'youtube', 'abcdefghijk')
