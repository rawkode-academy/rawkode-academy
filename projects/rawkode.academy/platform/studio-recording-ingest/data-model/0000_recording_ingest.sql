CREATE TABLE IF NOT EXISTS studio_recording_ingest_events (
  id TEXT PRIMARY KEY,
  bucket TEXT NOT NULL,
  object_key TEXT NOT NULL,
  object_etag TEXT NOT NULL,
  studio_session_id TEXT,
  recording_id TEXT,
  video_id TEXT,
  status TEXT NOT NULL,
  cloud_run_execution TEXT,
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS studio_recording_ingest_events_object_idx
  ON studio_recording_ingest_events(bucket, object_key, object_etag);
