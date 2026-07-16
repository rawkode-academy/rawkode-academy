ALTER TABLE studio_participants
	ADD COLUMN realtimekit_participant_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS studio_participants_realtimekit_participant_id_idx
	ON studio_participants (session_id, realtimekit_participant_id)
	WHERE realtimekit_participant_id IS NOT NULL;
