-- One in-flight public promotion per video. studio_promotion_claims is the
-- lease taken before the approved marker is rewritten. The partial index stops
-- a second promoted watchdog from committing if two workers pass that lease.
CREATE TABLE IF NOT EXISTS studio_promotion_claims (
	video_id TEXT PRIMARY KEY,
	recording_id TEXT NOT NULL,
	lease_until INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS studio_recordings_video_promotion_lease
	ON studio_recordings (video_id)
	WHERE visibility = 'review'
		AND review_state = 'promoted'
		AND review_next_attempt_at IS NOT NULL;
