ALTER TABLE studio_invite_redemptions
	ADD COLUMN state TEXT NOT NULL DEFAULT 'redeemed'
	CHECK (state IN ('pending', 'redeemed'));

ALTER TABLE studio_invite_redemptions
	ADD COLUMN claim_id TEXT;

ALTER TABLE studio_invite_redemptions
	ADD COLUMN finalized_at INTEGER;

UPDATE studio_invite_redemptions
	SET finalized_at = redeemed_at
	WHERE state = 'redeemed'
	  AND finalized_at IS NULL;

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

UPDATE studio_invites
	SET used_count = (
		SELECT COUNT(*)
		  FROM studio_invite_redemptions
		 WHERE studio_invite_redemptions.token_hash = studio_invites.token_hash
		   AND studio_invite_redemptions.state = 'redeemed'
	);
