ALTER TABLE studio_sessions
	ADD COLUMN stream_environment TEXT NOT NULL DEFAULT 'test'
	CHECK (stream_environment IN ('test', 'prod'));

ALTER TABLE studio_sessions
	ADD COLUMN stream_status TEXT NOT NULL DEFAULT 'idle'
	CHECK (stream_status IN ('idle', 'starting', 'live', 'ended', 'failed'));

ALTER TABLE studio_sessions
	ADD COLUMN cloudflare_stream_live_input_id TEXT;

ALTER TABLE studio_sessions
	ADD COLUMN cloudflare_stream_playback_url TEXT;

ALTER TABLE studio_sessions
	ADD COLUMN stream_started_at INTEGER;

ALTER TABLE studio_sessions
	ADD COLUMN stream_ended_at INTEGER;

ALTER TABLE studio_sessions
	ADD COLUMN stream_notification_queued_at INTEGER;

ALTER TABLE studio_sessions
	ADD COLUMN stream_start_token TEXT;

CREATE INDEX IF NOT EXISTS studio_sessions_public_live_idx
	ON studio_sessions (content_video_slug, stream_environment, stream_status);
