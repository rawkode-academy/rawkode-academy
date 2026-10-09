-- Broadcast times for Payload's editorial times. An outbox: each live transition of
-- a production, content-backed session queues one event, which is sent
-- fire-and-forget and retried by the 5 minute cron, so streaming never waits on
-- Payload. id is the Payload commandId and the signed Idempotency-Key.
CREATE TABLE IF NOT EXISTS studio_broadcast_events (
	id TEXT PRIMARY KEY NOT NULL,
	session_id TEXT NOT NULL,
	action TEXT NOT NULL CHECK (action IN ('broadcast-started', 'broadcast-ended')),
	content_video_id TEXT NOT NULL,
	occurred_at TEXT NOT NULL,
	state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sent', 'rejected')),
	attempts INTEGER NOT NULL DEFAULT 0,
	next_attempt_at INTEGER,
	last_error TEXT,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
	UNIQUE (session_id, action, occurred_at)
);

CREATE INDEX IF NOT EXISTS studio_broadcast_events_due_idx
	ON studio_broadcast_events (state, next_attempt_at);
