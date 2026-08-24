ALTER TABLE studio_sessions
	ADD COLUMN stream_heartbeat_at INTEGER;

-- Give publishers that were already active during rollout time to reload onto
-- the heartbeat-aware client before normal lease expiry begins.
UPDATE studio_sessions
	SET stream_heartbeat_at = unixepoch() + 120
	WHERE stream_status IN ('starting', 'live')
		AND stream_heartbeat_at IS NULL;

CREATE INDEX IF NOT EXISTS studio_sessions_stream_lease_idx
	ON studio_sessions (stream_status, stream_heartbeat_at);
