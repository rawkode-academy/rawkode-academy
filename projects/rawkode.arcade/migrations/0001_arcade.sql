-- The Durable Objects are authoritative for live state; D1 is the query and audit plane.
CREATE TABLE IF NOT EXISTS arcade_rooms (
	id TEXT PRIMARY KEY,
	game_key TEXT NOT NULL,
	title TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'lobby',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS arcade_room_outbox (
	id TEXT PRIMARY KEY,
	room_id TEXT NOT NULL,
	sequence INTEGER NOT NULL,
	kind TEXT NOT NULL,
	payload_json TEXT NOT NULL,
	occurred_at TEXT NOT NULL,
	UNIQUE(room_id, sequence)
);

CREATE TABLE IF NOT EXISTS arcade_results (
	room_id TEXT NOT NULL,
	principal_id TEXT NOT NULL,
	team_id TEXT,
	game_key TEXT NOT NULL,
	score INTEGER NOT NULL,
	rank INTEGER,
	completed_at TEXT NOT NULL,
	PRIMARY KEY(room_id, principal_id)
);

CREATE INDEX IF NOT EXISTS arcade_results_leaderboard
	ON arcade_results(game_key, score DESC, completed_at DESC);

CREATE TABLE IF NOT EXISTS arcade_room_invites (
	code TEXT PRIMARY KEY,
	room_id TEXT NOT NULL,
	role TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS arcade_moderation_actions (
	id TEXT PRIMARY KEY,
	room_id TEXT NOT NULL,
	actor_id TEXT NOT NULL,
	action TEXT NOT NULL,
	target_id TEXT,
	reason TEXT,
	created_at TEXT NOT NULL
);
