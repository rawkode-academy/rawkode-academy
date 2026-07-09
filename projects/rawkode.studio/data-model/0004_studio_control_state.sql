CREATE TABLE IF NOT EXISTS studio_control_state (
	session_id TEXT PRIMARY KEY,
	revision INTEGER NOT NULL DEFAULT 1,
	state_json TEXT NOT NULL,
	updated_by_id TEXT NOT NULL,
	updated_by_github TEXT,
	updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
	FOREIGN KEY (session_id) REFERENCES studio_sessions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS studio_control_state_updated_at_idx
	ON studio_control_state (updated_at);
