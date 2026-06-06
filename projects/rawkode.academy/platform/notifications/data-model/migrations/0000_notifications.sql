CREATE TABLE push_subscriptions (
	endpoint_hash TEXT PRIMARY KEY,
	endpoint TEXT NOT NULL UNIQUE,
	p256dh TEXT NOT NULL,
	auth TEXT NOT NULL,
	user_id TEXT,
	user_agent TEXT,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
	disabled_at INTEGER,
	last_error TEXT
);

CREATE TABLE notification_intents (
	id TEXT PRIMARY KEY,
	dedupe_key TEXT NOT NULL,
	kind TEXT NOT NULL,
	subject_key TEXT NOT NULL,
	title TEXT NOT NULL,
	body TEXT NOT NULL,
	url TEXT NOT NULL,
	tag TEXT NOT NULL,
	data_json TEXT NOT NULL DEFAULT '{}',
	endpoint_hash TEXT NOT NULL REFERENCES push_subscriptions(endpoint_hash) ON DELETE CASCADE,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
	cancelled_at INTEGER,
	UNIQUE(dedupe_key, endpoint_hash)
);

CREATE INDEX notification_intents_subject_idx
	ON notification_intents (subject_key, cancelled_at);

CREATE INDEX notification_intents_endpoint_idx
	ON notification_intents (endpoint_hash);

CREATE TABLE notification_sends (
	id TEXT PRIMARY KEY,
	notification_id TEXT NOT NULL,
	dedupe_key TEXT NOT NULL,
	endpoint_hash TEXT NOT NULL,
	sent_at INTEGER NOT NULL DEFAULT (unixepoch()),
	status TEXT NOT NULL,
	push_status INTEGER,
	error TEXT,
	UNIQUE(notification_id)
);
