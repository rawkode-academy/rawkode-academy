CREATE TABLE IF NOT EXISTS studio_sessions (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	show_id TEXT NOT NULL,
	show_title TEXT NOT NULL,
	starts_at TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'scheduled',
	recording_status TEXT NOT NULL DEFAULT 'idle',
	realtimekit_meeting_id TEXT,
	recording_prefix TEXT NOT NULL,
	created_by_id TEXT NOT NULL,
	created_by_github TEXT,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS studio_sessions_starts_at_idx
	ON studio_sessions (starts_at);

CREATE TABLE IF NOT EXISTS studio_participants (
	session_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	github_handle TEXT,
	role TEXT NOT NULL,
	name TEXT NOT NULL,
	image_url TEXT,
	joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
	PRIMARY KEY (session_id, user_id, role),
	FOREIGN KEY (session_id) REFERENCES studio_sessions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS studio_participants_session_role_idx
	ON studio_participants (session_id, role);

CREATE TABLE IF NOT EXISTS studio_recordings (
	recording_id TEXT PRIMARY KEY,
	session_id TEXT NOT NULL,
	video_id TEXT NOT NULL,
	source_bucket TEXT NOT NULL,
	source_key TEXT NOT NULL,
	source_etag TEXT NOT NULL,
	source_format TEXT NOT NULL,
	output_prefix TEXT NOT NULL,
	ready_marker_key TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'ready',
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
	FOREIGN KEY (session_id) REFERENCES studio_sessions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS studio_recordings_session_idx
	ON studio_recordings (session_id);

CREATE TABLE IF NOT EXISTS studio_invites (
	token_hash TEXT PRIMARY KEY,
	session_id TEXT NOT NULL,
	role TEXT NOT NULL DEFAULT 'guest',
	expires_at INTEGER NOT NULL,
	max_uses INTEGER NOT NULL DEFAULT 1,
	used_count INTEGER NOT NULL DEFAULT 0,
	created_by_id TEXT NOT NULL,
	created_by_github TEXT,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	revoked_at INTEGER,
	FOREIGN KEY (session_id) REFERENCES studio_sessions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS studio_invites_session_idx
	ON studio_invites (session_id);

CREATE TABLE IF NOT EXISTS studio_invite_redemptions (
	token_hash TEXT NOT NULL,
	user_id TEXT NOT NULL,
	github_handle TEXT,
	redeemed_at INTEGER NOT NULL DEFAULT (unixepoch()),
	PRIMARY KEY (token_hash, user_id),
	FOREIGN KEY (token_hash) REFERENCES studio_invites (token_hash) ON DELETE CASCADE
);
