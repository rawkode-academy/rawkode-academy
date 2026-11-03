-- Schema-only reconstruction of the migration recorded in the production D1
-- history. The original file and any data changes it contained are unavailable.
-- Existing databases with this filename in d1_migrations will skip this file.
ALTER TABLE studio_participants
	ADD COLUMN realtimekit_custom_participant_id TEXT;

ALTER TABLE studio_participants
	ADD COLUMN realtimekit_participant_id TEXT;

ALTER TABLE studio_participants
	ADD COLUMN provisioning_state TEXT NOT NULL DEFAULT 'unknown'
	CHECK (provisioning_state IN ('unknown', 'pending', 'ready'));

ALTER TABLE studio_participants
	ADD COLUMN invite_token_hash TEXT;

ALTER TABLE studio_participants
	ADD COLUMN invite_claim_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS studio_participants_realtimekit_identity_idx
	ON studio_participants (session_id, realtimekit_custom_participant_id)
	WHERE realtimekit_custom_participant_id IS NOT NULL;

ALTER TABLE studio_invite_redemptions
	ADD COLUMN state TEXT NOT NULL DEFAULT 'redeemed'
	CHECK (state IN ('pending', 'redeemed'));

ALTER TABLE studio_invite_redemptions
	ADD COLUMN claim_id TEXT;

ALTER TABLE studio_invite_redemptions
	ADD COLUMN finalized_at INTEGER;
