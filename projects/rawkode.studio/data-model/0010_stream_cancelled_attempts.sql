-- An attempt can be cancelled before its start request reaches the database.
-- Keep its exact token until the session is deleted so a delayed claim cannot
-- become a publisher after another attempt has started and ended.
CREATE TABLE studio_stream_cancelled_attempts (
	session_id TEXT NOT NULL,
	start_token TEXT NOT NULL,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	PRIMARY KEY (session_id, start_token),
	FOREIGN KEY (session_id) REFERENCES studio_sessions (id) ON DELETE CASCADE
);

-- Earlier versions stored a single pre-cancelled token on an inactive session.
INSERT OR IGNORE INTO studio_stream_cancelled_attempts (session_id, start_token)
	SELECT id, stream_start_token
	  FROM studio_sessions
	 WHERE stream_status NOT IN ('starting', 'live')
	   AND stream_start_token IS NOT NULL;
