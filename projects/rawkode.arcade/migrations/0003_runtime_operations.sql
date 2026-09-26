-- Query-plane records for authenticated admission, socket presence and exactly-once
-- projections. The live game state itself remains inside GameRoom Durable Objects.
CREATE TABLE IF NOT EXISTS arcade_room_memberships (
	room_id TEXT NOT NULL,
	principal_id TEXT NOT NULL,
	role TEXT NOT NULL,
	team_id TEXT,
	display_name TEXT,
	joined_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	PRIMARY KEY (room_id, principal_id),
	FOREIGN KEY (room_id) REFERENCES arcade_room_directory(id)
);
CREATE INDEX IF NOT EXISTS arcade_room_memberships_room_role ON arcade_room_memberships(room_id, role, team_id);

CREATE TABLE IF NOT EXISTS arcade_room_presence (
	room_id TEXT NOT NULL,
	principal_id TEXT NOT NULL,
	role TEXT NOT NULL,
	shard_id TEXT,
	connections INTEGER NOT NULL DEFAULT 0,
	connected_at TEXT,
	last_seen_at TEXT NOT NULL,
	PRIMARY KEY (room_id, principal_id),
	FOREIGN KEY (room_id) REFERENCES arcade_room_directory(id)
);
CREATE INDEX IF NOT EXISTS arcade_room_presence_room_seen ON arcade_room_presence(room_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS arcade_room_outbox_projections (
	outbox_id TEXT PRIMARY KEY,
	projected_at TEXT NOT NULL,
	FOREIGN KEY (outbox_id) REFERENCES arcade_room_outbox(id)
);
