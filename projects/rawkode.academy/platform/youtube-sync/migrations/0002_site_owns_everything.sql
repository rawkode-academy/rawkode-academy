-- The site owns the title, description and thumbnail, so a thumbnail is tracked
-- by the tag of the source image we last pushed.
ALTER TABLE youtube_sync_state ADD COLUMN thumb_tag TEXT;
ALTER TABLE youtube_sync_plan_items ADD COLUMN thumb_url TEXT;
ALTER TABLE youtube_sync_plan_items ADD COLUMN thumb_tag TEXT;
ALTER TABLE youtube_sync_plan_items ADD COLUMN thumb_changed INTEGER NOT NULL DEFAULT 0;

-- The thumbnail YouTube showed before each push, for rollback.
CREATE TABLE youtube_sync_thumbnails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id TEXT NOT NULL,
  youtube_id TEXT NOT NULL,
  at TEXT NOT NULL,
  before_tag TEXT,
  before_image BLOB
);
CREATE INDEX youtube_sync_thumbnails_video ON youtube_sync_thumbnails (youtube_id, id);
