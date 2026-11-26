-- Per video: the hash of the managed fields (title/description) we last pushed
-- or first saw. A live hash that differs from it means someone edited in Studio.
CREATE TABLE youtube_sync_state (
  youtube_id TEXT PRIMARY KEY,
  academy_id TEXT,
  base_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE youtube_sync_plans (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  fields TEXT NOT NULL,
  summary TEXT NOT NULL
);

CREATE TABLE youtube_sync_plan_items (
  plan_id TEXT NOT NULL REFERENCES youtube_sync_plans(id) ON DELETE CASCADE,
  youtube_id TEXT NOT NULL,
  academy_id TEXT,
  slug TEXT,
  status TEXT NOT NULL,
  reason TEXT,
  live_hash TEXT,
  desired TEXT,
  diff TEXT NOT NULL,
  PRIMARY KEY (plan_id, youtube_id)
);
CREATE INDEX youtube_sync_plan_items_status ON youtube_sync_plan_items (plan_id, status);

-- One row per write attempt. before_snippet/after_snippet are the full snippets,
-- kept for rollback.
CREATE TABLE youtube_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id TEXT NOT NULL,
  youtube_id TEXT NOT NULL,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,
  result TEXT NOT NULL,
  detail TEXT,
  before_snippet TEXT,
  after_snippet TEXT
);
CREATE INDEX youtube_sync_log_video ON youtube_sync_log (youtube_id, id);

-- Quota units spent per Pacific day (YouTube's quota resets at midnight Pacific).
CREATE TABLE youtube_sync_quota (
  day TEXT PRIMARY KEY,
  units INTEGER NOT NULL
);
