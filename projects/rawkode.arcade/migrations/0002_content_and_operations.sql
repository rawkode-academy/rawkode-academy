-- Durable Objects retain live state. This migration provides the durable
-- authoring, operations, audit and query planes around those actors.
CREATE TABLE IF NOT EXISTS arcade_operators (
	id TEXT PRIMARY KEY,
	identity_subject TEXT NOT NULL UNIQUE,
	display_name TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('host', 'producer', 'moderator', 'operator')),
	active INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS arcade_content_packs (
	id TEXT PRIMARY KEY,
	game_key TEXT NOT NULL,
	slug TEXT NOT NULL UNIQUE,
	title TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
	published_revision_id TEXT,
	created_by TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (created_by) REFERENCES arcade_operators(id)
);
CREATE INDEX IF NOT EXISTS arcade_content_packs_game_status ON arcade_content_packs(game_key, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS arcade_content_revisions (
	id TEXT PRIMARY KEY,
	pack_id TEXT NOT NULL,
	revision_number INTEGER NOT NULL,
	status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'published', 'archived')),
	manifest_json TEXT NOT NULL,
	checksum TEXT NOT NULL,
	created_by TEXT NOT NULL,
	created_at TEXT NOT NULL,
	published_at TEXT,
	UNIQUE(pack_id, revision_number),
	FOREIGN KEY (pack_id) REFERENCES arcade_content_packs(id),
	FOREIGN KEY (created_by) REFERENCES arcade_operators(id)
);
CREATE INDEX IF NOT EXISTS arcade_content_revisions_pack_status ON arcade_content_revisions(pack_id, status, revision_number DESC);

CREATE TABLE IF NOT EXISTS arcade_content_assets (
	id TEXT PRIMARY KEY,
	r2_key TEXT NOT NULL UNIQUE,
	content_type TEXT NOT NULL,
	byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
	sha256 TEXT NOT NULL,
	created_by TEXT NOT NULL,
	created_at TEXT NOT NULL,
	FOREIGN KEY (created_by) REFERENCES arcade_operators(id)
);

CREATE TABLE IF NOT EXISTS arcade_content_questions (
	id TEXT PRIMARY KEY,
	revision_id TEXT NOT NULL,
	ordinal INTEGER NOT NULL,
	kind TEXT NOT NULL,
	prompt TEXT NOT NULL,
	options_json TEXT,
	answer_json TEXT NOT NULL,
	asset_id TEXT,
	validation_json TEXT NOT NULL DEFAULT '{}',
	tags_json TEXT NOT NULL DEFAULT '[]',
	UNIQUE(revision_id, ordinal),
	FOREIGN KEY (revision_id) REFERENCES arcade_content_revisions(id),
	FOREIGN KEY (asset_id) REFERENCES arcade_content_assets(id)
);
CREATE INDEX IF NOT EXISTS arcade_content_questions_revision_ordinal ON arcade_content_questions(revision_id, ordinal);

CREATE TABLE IF NOT EXISTS arcade_room_directory (
	id TEXT PRIMARY KEY,
	game_key TEXT NOT NULL,
	content_revision_id TEXT,
	title TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'lobby',
	created_by TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (content_revision_id) REFERENCES arcade_content_revisions(id)
);
CREATE INDEX IF NOT EXISTS arcade_room_directory_game_status ON arcade_room_directory(game_key, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS arcade_room_invite_uses (
	invite_code TEXT NOT NULL,
	principal_id TEXT NOT NULL,
	used_at TEXT NOT NULL,
	PRIMARY KEY(invite_code, principal_id),
	FOREIGN KEY (invite_code) REFERENCES arcade_room_invites(code)
);

CREATE TABLE IF NOT EXISTS arcade_completed_games (
	id TEXT PRIMARY KEY,
	room_id TEXT NOT NULL UNIQUE,
	game_key TEXT NOT NULL,
	content_revision_id TEXT,
	season_id TEXT,
	completed_at TEXT NOT NULL,
	result_checksum TEXT NOT NULL,
	FOREIGN KEY (room_id) REFERENCES arcade_room_directory(id)
);
CREATE INDEX IF NOT EXISTS arcade_completed_games_game_completed ON arcade_completed_games(game_key, completed_at DESC);

CREATE TABLE IF NOT EXISTS arcade_seasons (
	id TEXT PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE,
	title TEXT NOT NULL,
	starts_at TEXT NOT NULL,
	ends_at TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('upcoming', 'active', 'complete')),
	created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS arcade_leaderboard_entries (
	season_id TEXT NOT NULL,
	game_key TEXT NOT NULL,
	principal_id TEXT NOT NULL,
	team_id TEXT,
	score INTEGER NOT NULL,
	games_played INTEGER NOT NULL DEFAULT 1,
	updated_at TEXT NOT NULL,
	PRIMARY KEY(season_id, game_key, principal_id),
	FOREIGN KEY (season_id) REFERENCES arcade_seasons(id)
);
CREATE INDEX IF NOT EXISTS arcade_leaderboard_rank ON arcade_leaderboard_entries(season_id, game_key, score DESC, updated_at ASC);

CREATE TABLE IF NOT EXISTS arcade_audit_log (
	id TEXT PRIMARY KEY,
	actor_id TEXT,
	action TEXT NOT NULL,
	resource_type TEXT NOT NULL,
	resource_id TEXT NOT NULL,
	payload_json TEXT NOT NULL DEFAULT '{}',
	created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS arcade_audit_resource ON arcade_audit_log(resource_type, resource_id, created_at DESC);
