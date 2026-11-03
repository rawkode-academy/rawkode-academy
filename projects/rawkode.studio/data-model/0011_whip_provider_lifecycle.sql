-- Production remains blocked until legacy WHIP inputs and uncertain creates
-- have been reconciled and all older Workers have been drained.
CREATE TABLE studio_whip_provider_readiness (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	production_ready INTEGER NOT NULL DEFAULT 0 CHECK (production_ready IN (0, 1)),
	provider_account_id TEXT,
	verified_by TEXT,
	evidence_reference TEXT,
	verified_at INTEGER,
	CHECK (production_ready = 0 OR (
		provider_account_id IS NOT NULL AND length(trim(provider_account_id)) > 0 AND
		verified_by IS NOT NULL AND length(trim(verified_by)) > 0 AND
		evidence_reference IS NOT NULL AND length(trim(evidence_reference)) > 0 AND
		verified_at IS NOT NULL
	))
);

INSERT INTO studio_whip_provider_readiness (id, production_ready) VALUES (1, 0);

-- Snapshot exact pre-cutover owners before a stop clears the lease token. This
-- is not an inventory: inactive and untracked inputs still require audit.
CREATE TABLE studio_whip_legacy_owners (
	session_id TEXT NOT NULL,
	start_token TEXT NOT NULL,
	provider_input_id TEXT,
	state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'retired')),
	PRIMARY KEY (session_id, start_token)
);

INSERT INTO studio_whip_legacy_owners (session_id, start_token, provider_input_id)
SELECT id, stream_start_token, cloudflare_stream_live_input_id
  FROM studio_sessions
 WHERE stream_status IN ('starting', 'live')
   AND stream_start_token IS NOT NULL;

CREATE TRIGGER studio_whip_provider_gate_requires_legacy_retirement
BEFORE UPDATE ON studio_whip_provider_readiness
WHEN NEW.production_ready = 1 AND EXISTS (
	SELECT 1 FROM studio_whip_legacy_owners WHERE state = 'pending'
)
BEGIN
	SELECT RAISE(ABORT, 'WHIP legacy owners are not retired');
END;

CREATE TABLE studio_whip_provider_attempts (
	attempt_id TEXT PRIMARY KEY,
	session_id TEXT NOT NULL,
	start_token TEXT NOT NULL,
	stream_environment TEXT NOT NULL CHECK (stream_environment IN ('prod', 'test')),
	provider_account_id TEXT NOT NULL,
	idempotency_key TEXT NOT NULL UNIQUE,
	create_body TEXT NOT NULL,
	takeover_starting_id TEXT NOT NULL,
	takeover_live_id TEXT NOT NULL,
	state TEXT NOT NULL CHECK (state IN ('reserved', 'creating', 'issued', 'uncertain', 'revoking', 'retired')),
	provider_input_id TEXT UNIQUE,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	dispatched_at INTEGER,
	updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
	UNIQUE (session_id, start_token)
);

CREATE TRIGGER studio_whip_provider_attempt_identity_immutable
BEFORE UPDATE ON studio_whip_provider_attempts
WHEN NEW.attempt_id IS NOT OLD.attempt_id
  OR NEW.session_id IS NOT OLD.session_id
  OR NEW.start_token IS NOT OLD.start_token
  OR NEW.stream_environment IS NOT OLD.stream_environment
  OR NEW.provider_account_id IS NOT OLD.provider_account_id
  OR NEW.idempotency_key IS NOT OLD.idempotency_key
  OR NEW.create_body IS NOT OLD.create_body
  OR NEW.takeover_starting_id IS NOT OLD.takeover_starting_id
  OR NEW.takeover_live_id IS NOT OLD.takeover_live_id
  OR (OLD.provider_input_id IS NOT NULL AND NEW.provider_input_id IS NOT OLD.provider_input_id)
BEGIN
	SELECT RAISE(ABORT, 'WHIP provider attempt identity is immutable');
END;

CREATE TRIGGER studio_whip_provider_attempt_pending_not_deleted
BEFORE DELETE ON studio_whip_provider_attempts
WHEN OLD.state <> 'retired'
BEGIN
	SELECT RAISE(ABORT, 'WHIP provider attempt is not retired');
END;

-- Do not cascade from the session: an unresolved provider input must remain
-- visible and block a replacement even if its Studio session disappears.
CREATE UNIQUE INDEX studio_whip_provider_one_prod_idx
	ON studio_whip_provider_attempts (stream_environment)
	WHERE stream_environment = 'prod' AND state <> 'retired';

CREATE UNIQUE INDEX studio_whip_provider_one_session_idx
	ON studio_whip_provider_attempts (session_id)
	WHERE state <> 'retired';

CREATE INDEX studio_whip_provider_reaper_idx
	ON studio_whip_provider_attempts (state, updated_at);

CREATE INDEX studio_whip_provider_takeover_starting_idx
	ON studio_whip_provider_attempts (session_id, takeover_starting_id);

CREATE INDEX studio_whip_provider_takeover_live_idx
	ON studio_whip_provider_attempts (session_id, takeover_live_id);
