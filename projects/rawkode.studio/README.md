# Rawkode Studio

Astro + Vue Studio for Rawkode live production, low-latency contributor rooms, and recording-first VOD handoff.

An operator can schedule a standalone production show from the Studio dashboard.
The new session appears on `play.rawkode.academy`; its producer room owns Go live
and End. The public `/api/studio/show-lineup` endpoint returns only upcoming
production sessions and a confirmed live session with its playback URL.
Content-backed sessions continue to appear on their Academy watch pages.

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
- `STUDIO_DB`: D1 database with `data-model/0000_studio_sessions.sql`.
- `RECORDINGS`: R2 bucket containing Studio recordings and ready markers. Production binds `rawkode-academy-content` so R2 Event Notifications can hand markers to the ingest Worker; the public content Worker denies `studio/recordings/*` while still serving final `videos/*` VOD output.
- `RECORDINGS_BUCKET_NAME`: name of the bound R2 recordings bucket written into ready markers.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account that owns the RealtimeKit app and Stream live inputs.
- `CLOUDFLARE_STREAM_API_TOKEN`: Cloudflare Stream API token from Secrets Store. It is used only by Studio server operations that create or inspect Stream live inputs.
- `STREAM_NOTIFICATIONS`: queue producer for `rawkode-academy-notifications`. Studio enqueues `SendSubjectInput` only after a prod stream is confirmed live.
- `REALTIMEKIT_API_TOKEN`, `REALTIMEKIT_APP_ID`: Cloudflare RealtimeKit API secrets from Secrets Store. `CLOUDFLARE_API_TOKEN` is only the deploy credential resolved by `env.cue`.
- `REALTIMEKIT_HOST_PRESET`, `REALTIMEKIT_PRODUCER_PRESET`, `REALTIMEKIT_GUEST_PRESET`, `REALTIMEKIT_PROGRAM_PRESET`: optional preset names for contributor tokens.
- `RAWKODE_GRAPHQL_URL`: Rawkode GraphQL gateway used to resolve content videos, shows, hosts, and guests. Defaults to `https://api.rawkode.academy/`.
- `STUDIO_OPERATOR_GITHUB_HANDLES`: comma-separated GitHub handles allowed to create sessions. Defaults to `rawkode`.
- `PAYLOAD`: service binding to `rawkode-academy-payload` (default entrypoint) for the client review handoff. `PAYLOAD_HANDOFF_URL` names the endpoint; the host only builds the URL, the binding routes it.
- `STUDIO_MACHINE_SECRET`: Secrets Store secret shared with Payload. Every Studio-to-Payload machine call is signed with it by `src/server/machine-auth.ts` (scheme documented in `projects/rawkode.academy/payload/README.md`).

## Recording Handoff

Studio writes ready markers to `studio/recordings/{sessionId}/{recordingId}/ready.json` after a recording object exists in R2. The marker matches the `studio-recording-ingest` Worker contract and points the Cloud Run transcoding job at the private source object and final VOD output prefix. Sessions attached to a content video publish to `videos/{videoId}/`; ad-hoc sessions fall back to `videos/{showId}/{sessionId}/`.

Only session managers can publish ready markers, and recording source keys must stay under the session recording prefix. D1 records the pending marker before the R2 ready marker is written so R2 Event Notifications cannot enqueue work before the session has a recording row.

Host and producer rooms upload browser programme recordings through `/api/studio/recording-upload` using R2 multipart uploads. The server creates the source key as `studio/recordings/{sessionId}/{recordingId}/source.webm`, the browser uploads 8 MiB parts, and completion publishes the ready marker with the completed R2 object ETag and the server-derived VOD target. Local development without a `RECORDINGS` binding keeps recording available by downloading the WebM locally instead.

## Client Review

A session created with "Requires client review before publishing" (`review_required`, off by default) hands each take to Payload review instead of publishing it. With review off, the v1 marker and the public VOD path are unchanged, with two guards: a public marker is refused (409) for a recording ID that belongs to another session or to a review take, and for a content video that still has a review take that could become public (see below).

1. The ready marker is contract v2 (`visibility: "review"`). Ingest transcodes a private 720p `review.mp4` under `studio/recordings/{sessionId}/{recordingId}/review/`; nothing reaches `videos/`.
2. Studio calls Payload's `POST /api/studio-handoff/adoptions` through `waitUntil`. The recording response never waits for Payload. The `*/5` cron in `src/worker.ts` retries with backoff (1, 5, 15 and 60 minutes, then 6 hours), polls until the revision is attached and published, and re-triggers a transcode that keeps failing (up to 3 times) by rewriting the marker.
3. Staff share the revision in Payload. When Payload publishes it, the cron promotes the recording: it rewrites `ready.json` as an `hls-approved` marker, so ingest publishes HLS at `videos/{videoId}/` without the raw source or `original.mkv`.
4. After promotion the cron watches `videos/{videoId}/transcode-status.json` every 15 minutes. A failed public transcode, or one with no terminal status 4 hours after it started (the Cloud Run task timeout is 3 hours), is re-triggered by rewriting the approved marker with `transcodeAttempt + 1`, at most 3 times; after that the recording keeps the error on the recordings page.

Promotions are serialized per video: while one take's public transcode is in flight, another published take of the same video waits, and a take whose publication is older than another published take of the same video is withdrawn as superseded, so `videos/{videoId}/` only ever receives the newest publication.

Every marker rewrite is conditional on the marker etag recorded in D1. If a rewrite succeeded but the D1 update after it failed, the next attempt finds the identical marker in R2 and adopts its etag instead of refusing. A take whose ready marker was never written (the browser never retried) is repaired by the cron from the D1 row when the source still matches, and otherwise marked failed with an error.

Attached takes that are never published are polled every 5 minutes for a day, hourly for 30 days, then daily; published, pending and promotion work runs ahead of those polls.

### Withdrawing a take

A take that will never be published (a rejected cut, or a transcode that used every retry) blocks public markers for its content video. A configured operator withdraws it with "Withdraw take" on the session's recordings page. A withdrawn take is never polled or promoted again and no longer blocks; publishing its revision in Payload afterwards does not make it public. A take already published in Payload cannot be withdrawn because its promotion is under way.

Only a configured operator can turn review off, and only before the session has a recording. A public recording is refused for a content video that still has a review take that is not promoted or withdrawn. Each take keeps a fresh recording ID; re-marking it with another source is refused. Requests carry the operator's Academy issuer and subject plus GitHub handle as `requestedBy`.

Payload outage drill: point `PAYLOAD_HANDOFF_URL` at a missing path (or rotate the Studio copy of `STUDIO_MACHINE_SECRET`) during a test session. Live streaming, recording, upload and recording-ready must all succeed (for a production content session, broadcast events stay `pending` in `studio_broadcast_events` and are delivered later); the recording shows `pending` with a `Payload 404` or `Payload 401` error on the recordings page. Restore the setting and confirm the cron delivers the adoption at the next retry (the backoff is at most 15 minutes after three failed attempts).

## Broadcast Times

Payload records when a live video actually started and ended (its editorial times). When a production session that is linked to a content video goes live, Studio queues a `broadcast-started` event in `studio_broadcast_events` (migration `0005_editorial_broadcast.sql`). Stopping the stream, or ending the session, queues `broadcast-ended`. Test streams and standalone shows without a content video report nothing.

- Each event is sent to Payload's `POST /api/editorial/broadcast` over the `PAYLOAD` binding, signed with `STUDIO_MACHINE_SECRET`. It carries the content video ID as `legacyId` and the stream time Studio stored, and the event id is the command id and the `Idempotency-Key`, so retries never record twice.
- Sending is fire-and-forget through `waitUntil`; going live or stopping never waits for Payload. The `*/5` cron resends pending events (backoff 1, 5 and 15 minutes, then hourly, so every retry lands inside Payload's 24 hour window) and keeps each session's end behind its start. It also re-queues the start or end of a production session from the last 23 hours whose outbox write was lost. A 400 or 409 from Payload is final (staff correct the times in Payload); a 5xx, including a race with a staff edit, is retried; after 20 failed attempts an event is marked `rejected`.
- Payload only accepts these for `live` videos, within 24 hours of the event. A stream stopped and restarted on the same session reports a second start after the first end: Payload keeps the first start and clears the end, so the show reads live again until the final end.

## Guest Access

Guest joins use opaque invite tokens stored as SHA-256 hashes in D1. Invite URLs resolve through `/guest/{token}`, then carry the token to the guest room and participant-token endpoint. Host, producer, and program roles require session management access.

## RealtimeKit Room UI

Studio room pages include a Vue room bridge that requests a participant token from `/api/studio/participant-token` and loads the Cloudflare RealtimeKit client/UI from jsDelivr on demand. Local fallback sessions intentionally stop at the provider-not-configured response until a persisted session has a RealtimeKit meeting ID.

Creating a RealtimeKit meeting only prepares the host/guest green room. Public streaming starts later from the programme canvas using Cloudflare Stream WebRTC/WHIP. A Studio session stores `streamEnvironment` as `test` or `prod`; test streams can publish to Stream for operator preview, while prod streams expose live state to the website and enqueue notifications only after Cloudflare reports the live input connected.

The browser production canvas remains a Vue island inside Astro pages. Hosts, producers, and guests authenticate through `rawkode.academy` identity, where the GitHub handle is the user ID used to attach people metadata.

## Live Verification

Run `bun run verify:live` through the production `cuenv` environment to verify Cloudflare auth, the deployed Worker, session KV, Studio D1 schema, content R2 bucket, and RealtimeKit Secrets Store entries without printing secret values.
