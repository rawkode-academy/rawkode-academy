-- Each scheduled broadcast gets its own stream (and so its own stream key). Saved the moment YouTube answers,
-- before the bind, so a retry never makes a second stream. Null for a broadcast bound to the channel's reusable stream.
ALTER TABLE youtube_sync_broadcasts ADD COLUMN stream_id TEXT;
-- Set once the stream has been deleted from YouTube after its broadcast completed.
ALTER TABLE youtube_sync_broadcasts ADD COLUMN stream_deleted_at TEXT;
