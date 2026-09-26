-- Studio owns the broadcast. Arcade stores only the optional interactive room.
CREATE TABLE IF NOT EXISTS arcade_show_participation (
	studio_session_id TEXT PRIMARY KEY,
	room_id TEXT NOT NULL UNIQUE,
	enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
	created_by TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (room_id) REFERENCES arcade_room_directory(id)
);
