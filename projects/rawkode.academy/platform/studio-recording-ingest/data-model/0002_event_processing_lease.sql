ALTER TABLE studio_recording_ingest_events
  ADD COLUMN processing_owner TEXT;

ALTER TABLE studio_recording_ingest_events
  ADD COLUMN processing_lease_until INTEGER;

CREATE INDEX studio_recording_ingest_events_processing_lease_idx
  ON studio_recording_ingest_events (status, processing_lease_until);

ALTER TABLE studio_recording_vod_claims
  ADD COLUMN dispatch_token TEXT;

ALTER TABLE studio_recording_vod_claims
  ADD COLUMN dispatch_attempted_at INTEGER;

ALTER TABLE studio_recording_vod_claims
  ADD COLUMN cloud_run_execution TEXT;

CREATE UNIQUE INDEX studio_recording_vod_claims_dispatch_token_idx
  ON studio_recording_vod_claims (dispatch_token)
  WHERE dispatch_token IS NOT NULL;
