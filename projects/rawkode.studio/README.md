# Rawkode Studio

Astro + Vue Studio for Rawkode live production, low-latency contributor rooms, and recording-first VOD handoff.

## Commands

```sh
bun run dev
bun run check
bun run test
bun run build
bun run verify:live
```

## Runtime Bindings

- `SESSION`: KV namespace for rawkode.academy identity sessions.
- `STUDIO_DB`: D1 database managed by the additive migrations in `data-model/`.
- `RECORDINGS`: R2 bucket containing Studio recordings and ready markers. Production binds `rawkode-academy-content` so R2 Event Notifications can hand markers to the ingest Worker; the public content Worker denies `studio/recordings/*` while still serving final `videos/*` VOD output.
- `RECORDINGS_BUCKET_NAME`: name of the bound R2 recordings bucket written into ready markers.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account that owns the RealtimeKit app and Stream live inputs.
- `CLOUDFLARE_STREAM_API_TOKEN`: Cloudflare Stream API token from Secrets Store. It is used only by Studio server operations that create or inspect Stream live inputs.
- `STREAM_NOTIFICATIONS`: queue producer for `rawkode-academy-notifications`. Studio enqueues `SendSubjectInput` only after a prod stream is confirmed live.
- `REALTIMEKIT_API_TOKEN`, `REALTIMEKIT_APP_ID`: Cloudflare RealtimeKit API secrets from Secrets Store. `CLOUDFLARE_API_TOKEN` is only the deploy credential resolved by `env.cue`.
- `REALTIMEKIT_HOST_PRESET`, `REALTIMEKIT_PRODUCER_PRESET`, `REALTIMEKIT_GUEST_PRESET`, `REALTIMEKIT_PROGRAM_PRESET`: contributor-token preset names. Production maps host, producer, and program to `group_call_host`, and guests to the narrower `group_call_guest` preset.
- `RAWKODE_GRAPHQL_URL`: Rawkode GraphQL gateway used to resolve content videos, shows, hosts, and guests. Defaults to `https://api.rawkode.academy/`.
- `STUDIO_OPERATOR_GITHUB_HANDLES`: required comma-separated GitHub handles allowed to access the private control plane. Production explicitly sets this to `rawkode`; a missing or blank value authorizes nobody.

## Recording Handoff

Studio writes ready markers to `studio/recordings/{sessionId}/{recordingId}/ready.json` after a recording object exists in R2. The marker matches the `studio-recording-ingest` Worker contract and points the Cloud Run transcoding job at the private source object and final VOD output prefix. Sessions attached to a content video publish to `videos/{videoId}/`; ad-hoc sessions fall back to `videos/{showId}/{sessionId}/`.

Only session managers can publish ready markers, and recording source keys must stay under the session recording prefix. D1 records the pending marker before the R2 ready marker is written so R2 Event Notifications cannot enqueue work before the session has a recording row.

The operator control room uploads browser programme recordings through `/api/studio/recording-upload` using R2 multipart uploads. The server creates the source key as `studio/recordings/{sessionId}/{recordingId}/source.webm`, the browser uploads 8 MiB parts, and completion publishes the ready marker with the completed R2 object ETag and the server-derived VOD target. Transient part-upload failures receive three bounded attempts. Multipart completion is intentionally not retried because completion plus the D1/ready-marker handoff is not yet idempotent; an ambiguous failure can leave an R2 source object without a completed handoff.

Every browser recording chunk is also persisted to IndexedDB with content type, timestamps, chunk count, and size metadata. A successful server handoff clears that backup. Failed and local-only handoffs retain it across reloads; open **Local recording recovery** in the operator canvas to reconstruct/download the WebM, then delete the browser copy only after verifying the file. Clearing site data or using another browser profile removes these backups.

For every Prod broadcast, start an independent local OBS programme recording (or an operating-system screen recording if OBS is unavailable) before arming Prod. Cloudflare Stream WHIP/WHEP does not provide a provider-side recording fallback. Keep the independent recording until the VOD handoff and playback are verified. If the browser handoff fails, preserve the independent recording, download the IndexedDB recovery copy, and reconcile any orphaned `source.webm` in R2 before retrying ingestion.

## Guest Access

Guest joins use opaque invite tokens stored as SHA-256 hashes in D1. Invite URLs resolve through `/guest/{token}`, then carry the token to the guest room and participant-token endpoint. A transactional pending claim reserves invite capacity before RealtimeKit provisioning; the redemption count is finalized only after the exact provider participant is stored, so retries cannot double-consume an invite. Host, producer, and program roles require session management access.

## RealtimeKit Room UI

Studio room pages include a Vue room bridge that requests a participant token from `/api/studio/participant-token` and loads the Cloudflare RealtimeKit client/UI from jsDelivr on demand. Local fallback sessions intentionally stop at the provider-not-configured response until a persisted session has a RealtimeKit meeting ID.

Creating a RealtimeKit meeting only prepares the host/guest green room. Public streaming starts later from the programme canvas using Cloudflare Stream WebRTC/WHIP. A Studio session stores `streamEnvironment` as `test` or `prod`; test streams can publish to Stream for operator preview, while prod streams expose live state to the website and enqueue notifications only after Cloudflare reports the live input connected.

The browser production canvas remains a Vue island inside Astro pages. Hosts, producers, and guests authenticate through `rawkode.academy` identity. RealtimeKit uses the stable opaque identity `user.id`; GitHub handles are used only to enrich people metadata and to reconcile participants created before the opaque-ID contract.

## Live Verification

Run `bun run verify:live` through the production `cuenv` environment after deployment. It verifies the checked-in production binding shapes, Cloudflare auth and deployed Worker, session KV, Studio D1 stream and participant-provisioning schema, content R2 bucket, notifications queue, Secrets Store and all three runtime secret names (including `CLOUDFLARE_STREAM_API_TOKEN`), the configured RealtimeKit presets against the live app, and the public live-state HTTP contract without printing secret values.
