-- Writes run through a Cloudflare Queue, one message per video. A message the
-- queue gives up on (retries used up, or a failure retrying can't fix) is
-- recorded here, and the daily monitor opens an issue while any is outstanding.
CREATE TABLE youtube_sync_dead (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id TEXT,
  youtube_id TEXT,
  at TEXT NOT NULL,
  reason TEXT NOT NULL
);
CREATE INDEX youtube_sync_dead_video ON youtube_sync_dead (youtube_id);
