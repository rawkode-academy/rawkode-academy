ALTER TABLE studio_sessions
	ADD COLUMN content_video_id TEXT;

ALTER TABLE studio_sessions
	ADD COLUMN content_hosts_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE studio_sessions
	ADD COLUMN content_guests_json TEXT NOT NULL DEFAULT '[]';
