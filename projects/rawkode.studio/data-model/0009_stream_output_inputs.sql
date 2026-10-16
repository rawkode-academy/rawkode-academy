CREATE TABLE IF NOT EXISTS studio_stream_output_inputs (
	session_id TEXT PRIMARY KEY,
	input_mode TEXT NOT NULL DEFAULT 'rtmps-srt'
		CHECK (input_mode = 'rtmps-srt'),
	provision_state TEXT NOT NULL
		CHECK (provision_state IN ('provisioning', 'ready', 'uncertain')),
	claim_token TEXT NOT NULL,
	claimed_at INTEGER NOT NULL,
	cloudflare_live_input_id TEXT UNIQUE,
	created_by_id TEXT NOT NULL,
	created_at INTEGER,
	updated_at INTEGER NOT NULL,
	FOREIGN KEY (session_id) REFERENCES studio_sessions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS studio_stream_output_inputs_state_idx
	ON studio_stream_output_inputs (provision_state, claimed_at);
