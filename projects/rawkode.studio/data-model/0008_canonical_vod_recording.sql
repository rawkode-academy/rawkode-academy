-- Production must pass the duplicate audit in README.md before this migration
-- is applied. The unique index is the durable one-canonical-recording invariant.
CREATE UNIQUE INDEX studio_recordings_video_id_unique_idx
	ON studio_recordings (video_id);
