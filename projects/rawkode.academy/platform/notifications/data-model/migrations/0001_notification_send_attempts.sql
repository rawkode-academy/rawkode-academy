ALTER TABLE notification_sends ADD COLUMN attempt_id TEXT;
ALTER TABLE notification_sends ADD COLUMN attempts INTEGER NOT NULL DEFAULT 1;

CREATE INDEX notification_sends_retry_idx
	ON notification_sends (status, sent_at, attempts);
