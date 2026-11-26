-- One YouTube broadcast per scheduled live stream. Saved the moment YouTube
-- answers, before the video is linked to it, so a retry never makes a second one.
CREATE TABLE youtube_sync_broadcasts (
  video_id TEXT PRIMARY KEY,
  broadcast_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  linked_at TEXT,
  bound_at TEXT
);
