-- A push after a video update plans just that video. Such a plan must not become
-- "latest", which apply and the monitor read as the daily full plan.
ALTER TABLE youtube_sync_plans ADD COLUMN scope TEXT NOT NULL DEFAULT 'full';
