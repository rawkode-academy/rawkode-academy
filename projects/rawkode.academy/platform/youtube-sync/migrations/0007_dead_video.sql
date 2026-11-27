-- A dead letter from a video event (video.updated / video.scheduled) names only the Academy video, not a YouTube id,
-- so the "written successfully since" check never matched it and it kept the monitor issue open for good.
-- It now records the Academy video id and is resolved when a later event for that video goes through.
ALTER TABLE youtube_sync_dead ADD COLUMN video_id TEXT;
ALTER TABLE youtube_sync_dead ADD COLUMN resolved_at TEXT;
-- Rows already recorded: the reason reads "video <id>: ...".
UPDATE youtube_sync_dead SET video_id = substr(reason, 7, instr(substr(reason, 7), ':') - 1) WHERE reason LIKE 'video %:%' AND video_id IS NULL;
