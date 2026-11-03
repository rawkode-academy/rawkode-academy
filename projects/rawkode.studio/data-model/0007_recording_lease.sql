ALTER TABLE studio_sessions
	ADD COLUMN recording_lease_id TEXT;

ALTER TABLE studio_sessions
	ADD COLUMN recording_heartbeat_at INTEGER;

ALTER TABLE studio_sessions
	ADD COLUMN recording_lease_grace_until INTEGER;

-- Give recordings that started before this migration ten minutes to adopt their
-- recording ID on their next part, completion, abort, or heartbeat request.
UPDATE studio_sessions
	SET recording_lease_grace_until = unixepoch() + 600
	WHERE recording_status = 'recording'
	  AND recording_lease_id IS NULL;

CREATE INDEX IF NOT EXISTS studio_sessions_recording_lease_idx
	ON studio_sessions (recording_lease_id, recording_heartbeat_at);
