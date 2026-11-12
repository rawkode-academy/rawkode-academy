# Studio Recording Ingest

Queue consumer for Rawkode Studio recording markers.

RealtimeKit recording output should be copied into `rawkode-academy-content` under:

```text
studio/recordings/{studioSessionId}/{recordingId}/{source-file}
studio/recordings/{studioSessionId}/{recordingId}/ready.json
```

The `ready.json` object is the durable handoff contract. R2 Event Notifications deliver that object-create event to this Worker through a Cloudflare Queue. The Worker validates the marker, stores an idempotency record in D1, and triggers the existing Cloud Run `transcoding-job` with the source object and target VOD prefix.

Each marker is also a one-time request to claim the canonical `videos/{videoId}/` VOD prefix. Before claiming, the Worker requires the marker source bucket to match the notification bucket and verifies that the source object exists with the same normalized ETag. The first immutable recording tuple for a video wins. Exact redeliveries of that recording are accepted for recovery from Worker failures and ambiguous Cloud Run dispatches; a different recording or changed source identity is terminally rejected before canonical status is written or Cloud Run is invoked. Claims do not expire automatically.

Queue delivery is separately claimed by event ID with a 120-second owner-token lease. Active duplicates are delayed and retried instead of acknowledged, so an uncatchable Worker exit cannot strand the final delivery. An expired `processing`, legacy `received`, or `validated` row can be reclaimed by exactly one new owner; every state transition is owner-guarded. `triggered` and `rejected` deliveries are terminal duplicates.

Cloud Run `jobs.run` has no request ID or execution-token field. The Worker therefore derives a deterministic `STUDIO_DISPATCH_TOKEN` from the complete immutable recording identity and stores a dispatch attempt in the canonical claim before calling Google. Every attempt first paginates Cloud Run executions and matches the token plus the complete environment tuple. If the POST response is lost, the Worker waits up to a durable 10-minute visibility window and reconciles instead of posting again. After the window, an attempt that still has no provider execution may be retried; a crash before the first POST therefore delays work but does not lose it permanently.

## Ready Marker

```json
{
  "contractVersion": 1,
  "videoId": "rawkode-live-example",
  "studioSessionId": "rawkode-live-next",
  "recordingId": "recording-2026-06-06",
  "sourceBucket": "rawkode-academy-content",
  "sourceKey": "studio/recordings/rawkode-live-next/recording-2026-06-06/program.webm",
  "sourceEtag": "abc123",
  "sourceFormat": "webm",
  "outputPrefix": "videos/rawkode-live-example/"
}
```

## Cloudflare resources

The checked-in Wrangler configuration and resource scripts target production.
For a fresh isolated environment, use a separate account or explicitly isolated
database, buckets, queues, Cloud Run job, secret bindings and Wrangler config;
verify those targets before creating resources or deploying. Do not use the
production resource-creation scripts as a fresh-setup recipe. Creating or
uploading a service-account secret is a separate authorized operation.

The Worker needs:

- `DB`: D1 database `platform-studio-recording-ingest`, with every migration in `data-model/` through `0002_event_processing_lease.sql` applied before the Worker is deployed.
- `RECORDINGS`: R2 bucket binding for `rawkode-academy-content`.
- Queue consumer for `platform-studio-recording-ingest`, with failures sent to `platform-studio-recording-ingest-dlq`.
- `GCP_PROJECT_ID`: Google Cloud project containing the transcode job, currently `rawkode-academy-production`.
- `GCP_REGION`: Cloud Run job region, currently `europe-west2`.
- `GCP_TRANSCODING_JOB`: Cloud Run job name, currently `transcoding-job`.
- `GCP_SERVICE_ACCOUNT_JSON`: Secrets Store binding containing service account JSON with permission to run that Cloud Run job with overrides and list its executions. The exact runtime permissions are `run.jobs.runWithOverrides` and `run.executions.list`.

The deployable `wrangler.jsonc` pins the production D1 UUID because Wrangler requires `database_id` for remote migration operations. Run `bun run verify:live` after deployment to verify Cloudflare auth, D1 schema, queue/DLQ, Worker deployment, the `GCP_SERVICE_ACCOUNT_JSON` Secrets Store entry, the R2 ready-marker notification, the Cloud Run transcoding job, and execution-list visibility for the operator identity. The verifier does not read the service-account secret, so the runtime account's `run.executions.list` permission must still be proven with a controlled end-to-end marker rehearsal.

The default and pull-request CI pipelines run check, test, and deploy dry-run only; they do not apply remote migrations, deploy, or resolve production secrets. Production rollout remains a separately ordered operation until a failure-closed cross-service coordinator is available.

## Ordered production rollout and canonical VOD audit

The two Workers and legacy importers do not share a deployment gate. Do not run
the remote migration or deployment commands until the following steps are
complete. Keep the writers quiesced through the ingest rollout and claim seeding.

1. Quiesce the old recording-ingest consumer, new Studio recording handoffs,
   legacy YouTube and Descript importers, manual Cloud Run invocations and any
   other writers to `videos/{videoId}/`. Account for queued messages and wait
   for already-dispatched Cloud Run executions and uploads to finish. Stop if
   the operator cannot prove that these writers and in-flight work are fenced.
2. Export the ingest D1 database and preserve the relevant ready markers, source
   identities, canonical status documents and output evidence. Audit existing
   ingest events, including nonterminal or ambiguous deliveries, and reconcile
   unresolved dispatches before proceeding. The following query identifies
   video IDs with multiple successful recordings before `0001`:

```sql
SELECT video_id,
       COUNT(DISTINCT recording_id) AS recording_count,
       GROUP_CONCAT(DISTINCT recording_id) AS recording_ids
  FROM studio_recording_ingest_events
 WHERE video_id IS NOT NULL
   AND status = 'triggered'
 GROUP BY video_id
HAVING COUNT(DISTINCT recording_id) > 1;
```

Stop if this returns rows. Do not infer the winner from D1 timestamps because Cloud Run executions complete asynchronously. Inspect `videos/{videoId}/transcode-status.json`, the canonical `stream.m3u8`, and the corresponding ready marker. A stream without a full attributable status document is an unresolved conflict and must not be adopted automatically. The query is not a substitute for inspecting existing outputs and markers that lack a matching successful event.

3. While writers remain quiesced, apply the ingest migrations through
   `0002_event_processing_lease.sql`. Migration `0001` creates the claims table;
   the seed below cannot run before it exists.
4. Before enabling the new consumer, seed each pre-existing canonical Studio
   VOD using only the exact tuple verified in both its status document and ready
   marker. Stop for any output whose identity cannot be established:

```sql
INSERT INTO studio_recording_vod_claims (
  video_id, recording_id, studio_session_id, source_bucket, source_key,
  source_etag, source_format, output_prefix, ready_marker_key
) VALUES (
  '<video-id>', '<recording-id>', '<session-id>', '<source-bucket>', '<source-key>',
  '<source-etag>', '<source-format>', 'videos/<video-id>/', '<ready-marker-key>'
);
```

5. Deploy the new ingest Worker, verify that the intended version is serving,
   run `verify:live`, and complete a controlled marker rehearsal with the runtime
   identity. Restore queue delivery only in the controlled order needed for
   that rehearsal, then verify delivery and reconciliation. Keep legacy and
   manual writers fenced from Studio-owned video IDs.
6. Only after ingest is verified, apply and deploy Studio in the order described
   in the Studio runbook. Permit content-backed production recording only after
   both Workers and their handoff have passed the required checks.

The legacy YouTube and Descript importers, manual Cloud Run invocations, and any other process that writes `videos/{videoId}/` do not acquire this claim. They must be routed through the same claim contract before the restriction on Studio-owned video IDs can be removed. Do not roll back ingest to a version that ignores the claims/dispatch tables while Studio handoff remains enabled.

## Transcode Status

When a ready marker is accepted, the Worker writes:

```text
{outputPrefix}/transcode-status.json
```

with `status: "queued"` before invoking Cloud Run. After a dispatch attempt, an error can be ambiguous, so ingest leaves this status queued while the event row records the failure and provider reconciliation runs; it must not publish a false canonical failure that a running execution could overwrite. Once the Cloud Run job starts, it overwrites the same object with `status: "running"`, then either `status: "complete"` when HLS output is available or `status: "failed"` if download, normalization, FFmpeg, audio extraction, or R2 sync fails.

Before claiming a new prefix, ingest also checks existing canonical state. A status document must contain the exact marker identity. A canonical stream without an attributable status, or a status belonging to another recording, is rejected without writing to the prefix. A matching completed status and stream bootstrap the durable D1 claim without rerunning Cloud Run.

## Validation

```bash
bun run check
bun run test
bun x wrangler deploy --dry-run
bun run verify:live
```
