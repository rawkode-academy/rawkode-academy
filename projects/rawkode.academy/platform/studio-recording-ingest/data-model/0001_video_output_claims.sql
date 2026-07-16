CREATE TABLE IF NOT EXISTS studio_recording_vod_claims (
  video_id TEXT PRIMARY KEY,
  recording_id TEXT NOT NULL UNIQUE,
  studio_session_id TEXT NOT NULL,
  source_bucket TEXT NOT NULL,
  source_key TEXT NOT NULL,
  source_etag TEXT NOT NULL,
  source_format TEXT NOT NULL,
  output_prefix TEXT NOT NULL,
  ready_marker_key TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
