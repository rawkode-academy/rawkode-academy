-- Client review before publishing. Every column is additive with a safe default,
-- so existing sessions and recordings stay public and unchanged.
ALTER TABLE studio_sessions
	ADD COLUMN review_required INTEGER NOT NULL DEFAULT 0
	CHECK (review_required IN (0, 1));

ALTER TABLE studio_recordings
	ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'
	CHECK (visibility IN ('public', 'review'));

ALTER TABLE studio_recordings
	ADD COLUMN source_bytes INTEGER;

ALTER TABLE studio_recordings
	ADD COLUMN review_prefix TEXT;

ALTER TABLE studio_recordings
	ADD COLUMN review_idempotency_key TEXT;

ALTER TABLE studio_recordings
	ADD COLUMN review_state TEXT
	CHECK (review_state IS NULL OR review_state IN ('pending', 'awaiting-transcode', 'attached', 'published', 'promoted', 'failed', 'withdrawn'));

ALTER TABLE studio_recordings
	ADD COLUMN review_requested_by TEXT;

ALTER TABLE studio_recordings
	ADD COLUMN review_adoption_id TEXT;

ALTER TABLE studio_recordings
	ADD COLUMN review_payload_video_id INTEGER;

ALTER TABLE studio_recordings
	ADD COLUMN review_revision_id TEXT;

ALTER TABLE studio_recordings
	ADD COLUMN review_publication_id TEXT;

ALTER TABLE studio_recordings
	ADD COLUMN review_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE studio_recordings
	ADD COLUMN review_transcode_attempt INTEGER NOT NULL DEFAULT 0;

ALTER TABLE studio_recordings
	ADD COLUMN review_marker_etag TEXT;

ALTER TABLE studio_recordings
	ADD COLUMN review_next_attempt_at INTEGER;

ALTER TABLE studio_recordings
	ADD COLUMN review_last_error TEXT;

ALTER TABLE studio_recordings
	ADD COLUMN review_attached_at INTEGER;

ALTER TABLE studio_recordings
	ADD COLUMN review_promoted_at INTEGER;

ALTER TABLE studio_recordings
	ADD COLUMN review_published_at INTEGER;

ALTER TABLE studio_recordings
	ADD COLUMN review_promotion_attempt INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS studio_recordings_review_idx
	ON studio_recordings (visibility, review_state, review_next_attempt_at);

CREATE INDEX IF NOT EXISTS studio_recordings_video_idx
	ON studio_recordings (video_id);
