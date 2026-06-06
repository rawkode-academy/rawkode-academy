# Studio Recording Ingest

Queue consumer for Rawkode Studio recording markers.

RealtimeKit recording output should be copied into `rawkode-academy-content` under:

```text
studio/recordings/{studioSessionId}/{recordingId}/{source-file}
studio/recordings/{studioSessionId}/{recordingId}/ready.json
```

The `ready.json` object is the durable handoff contract. R2 Event Notifications deliver that object-create event to this Worker through a Cloudflare Queue. The Worker validates the marker, stores an idempotency record in D1, and triggers the existing Cloud Run `transcoding-job` with the source object and target VOD prefix.

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

## Cloudflare Resources

Create the Cloudflare resources, apply the D1 migration, deploy the Worker, then attach the R2 notification rule:

```bash
bun run d1:create
bun run queues:create
bun run migrate
bun x wrangler secrets-store secret create 492e5e40b9d64ebeac7e7a77db91ff6e --name GCP_SERVICE_ACCOUNT_JSON --scopes workers
bun run deploy
bun run notify:create
bun run verify:live
```

The Worker needs:

- `DB`: D1 database `platform-studio-recording-ingest`, with `data-model/0000_recording_ingest.sql` applied.
- `RECORDINGS`: R2 bucket binding for `rawkode-academy-content`.
- Queue consumer for `platform-studio-recording-ingest`, with failures sent to `platform-studio-recording-ingest-dlq`.
- `GCP_PROJECT_ID`: Google Cloud project containing the transcode job, currently `rawkode-academy-production`.
- `GCP_REGION`: Cloud Run job region, currently `europe-west2`.
- `GCP_TRANSCODING_JOB`: Cloud Run job name, currently `transcoding-job`.
- `GCP_SERVICE_ACCOUNT_JSON`: Secrets Store binding containing service account JSON with permission to run that Cloud Run job.

The deployable `wrangler.jsonc` pins the production D1 UUID because Wrangler requires `database_id` for remote migration operations. Run `bun run verify:live` after deployment to verify Cloudflare auth, D1 schema, queue/DLQ, Worker deployment, the `GCP_SERVICE_ACCOUNT_JSON` Secrets Store entry, the R2 ready-marker notification, and the Cloud Run transcoding job.

## Transcode Status

When a ready marker is accepted, the Worker writes:

```text
{outputPrefix}/transcode-status.json
```

with `status: "queued"` before invoking Cloud Run. If Cloud Run cannot be triggered, the Worker overwrites that status document with `status: "failed"` and the failure message. Once the Cloud Run job starts, it overwrites the same object with `status: "running"`, then either `status: "complete"` when HLS output is available or `status: "failed"` if download, normalization, FFmpeg, audio extraction, or R2 sync fails.

## Validation

```bash
bun run check
bun run test
bun x wrangler deploy --dry-run
bun run verify:live
```
