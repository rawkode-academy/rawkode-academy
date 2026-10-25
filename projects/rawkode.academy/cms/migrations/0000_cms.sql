-- The CMS's own state. Content lives in the platform services; this database
-- holds who may edit, pending proposals and the activity feed.

-- Browser sessions (cookie value hashed with SHA-256).
CREATE TABLE sessions (
	id_hash TEXT PRIMARY KEY NOT NULL,
	user_id TEXT NOT NULL,
	name TEXT NOT NULL,
	email TEXT,
	roles TEXT NOT NULL,
	expires_at INTEGER NOT NULL,
	created_at INTEGER NOT NULL
);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

-- API tokens for agents. The secret is shown once; only its hash is kept.
CREATE TABLE api_tokens (
	id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL,
	role TEXT NOT NULL,
	secret_hash TEXT NOT NULL,
	created_by TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	last_used_at INTEGER,
	revoked_at INTEGER
);

-- Which person a guest, or which technology a partner, may propose changes to.
CREATE TABLE access_links (
	user_id TEXT NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('person', 'technology')),
	target_id TEXT NOT NULL,
	created_by TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (user_id, kind, target_id)
);

-- Changes waiting for an admin: from guests, partners and agents.
CREATE TABLE proposals (
	id TEXT PRIMARY KEY NOT NULL,
	collection TEXT NOT NULL,
	entity_id TEXT,
	-- "create" | "update" | "list"
	kind TEXT NOT NULL,
	-- The panel (list model) for kind = "list".
	list TEXT,
	payload TEXT NOT NULL,
	base_version INTEGER NOT NULL,
	author_id TEXT NOT NULL,
	author_kind TEXT NOT NULL,
	author_name TEXT,
	status TEXT NOT NULL DEFAULT 'pending',
	note TEXT,
	created_at INTEGER NOT NULL,
	decided_by TEXT,
	decided_at INTEGER
);
CREATE INDEX proposals_status_idx ON proposals (status, created_at);

-- Every write the CMS made, newest first on the dashboard.
CREATE TABLE activity (
	id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
	actor_id TEXT NOT NULL,
	actor_name TEXT,
	collection TEXT NOT NULL,
	entity_id TEXT NOT NULL,
	operation TEXT NOT NULL,
	version INTEGER,
	at INTEGER NOT NULL
);
CREATE INDEX activity_at_idx ON activity (at);
