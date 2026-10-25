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

## Recording Handoff

Studio writes ready markers to `studio/recordings/{sessionId}/{recordingId}/ready.json` after a recording object exists in R2. The marker matches the `studio-recording-ingest` Worker contract and points the Cloud Run transcoding job at the private source object and final VOD output prefix. Sessions attached to a content video publish to `videos/{videoId}/`; ad-hoc sessions fall back to `videos/{showId}/{sessionId}/`.

Only session managers can publish ready markers, and recording source keys must stay under the session recording prefix. D1 records the pending marker before the R2 ready marker is written so R2 Event Notifications cannot enqueue work before the session has a recording row.

Host and producer rooms upload browser programme recordings through `/api/studio/recording-upload` using R2 multipart uploads. The server creates the source key as `studio/recordings/{sessionId}/{recordingId}/source.webm`, the browser uploads 8 MiB parts, and completion publishes the ready marker with the completed R2 object ETag and the server-derived VOD target. Local development without a `RECORDINGS` binding keeps recording available by downloading the WebM locally instead.

## Guest Access

Guest joins use opaque invite tokens stored as SHA-256 hashes in D1. Invite URLs resolve through `/guest/{token}`, then carry the token to the guest room and participant-token endpoint. Host, producer, and program roles require session management access.

## RealtimeKit Room UI

Studio room pages include a Vue room bridge that requests a participant token from `/api/studio/participant-token` and loads the Cloudflare RealtimeKit client/UI from jsDelivr on demand. Local fallback sessions intentionally stop at the provider-not-configured response until a persisted session has a RealtimeKit meeting ID.

Creating a RealtimeKit meeting only prepares the host/guest green room. Public streaming starts later from the programme canvas using Cloudflare Stream WebRTC/WHIP. A Studio session stores `streamEnvironment` as `test` or `prod`; test streams can publish to Stream for operator preview, while prod streams expose live state to the website and enqueue notifications only after Cloudflare reports the live input connected.

The browser production canvas remains a Vue island inside Astro pages. Hosts, producers, and guests authenticate through `rawkode.academy` identity, where the GitHub handle is the user ID used to attach people metadata.

## Stream WebRTC

Studio already uses the WHIP/WHEP live-input API covered by [Cloudflare Stream WebRTC general availability on October 15, 2026](https://developers.cloudflare.com/changelog/post/2026-10-15-stream-live-webrtc-ga/). The existing integration does not require a transport migration for GA:

- `src/server/cloudflare-stream.ts` creates or inspects Stream live inputs using the server-only `CLOUDFLARE_STREAM_API_TOKEN` binding. The API returns `webRTC.url` for WHIP publishing and `webRTCPlayback.url` for WHEP playback.
- `src/live/whipClient.ts` publishes the composed programme canvas and mixed audio from the host or producer browser. The WHIP URL contains a broadcast credential and is returned only to an authorized session manager.
- `src/server/operations.ts` confirms the input is connected before publishing production live state and enqueueing notifications. Public live-state responses expose only the playback URL.
- `../rawkode.academy/website/src/components/video/CloudflareWhepPlayer.vue` receives the broadcast through WHEP on Academy watch pages. Both browser clients close their peer connection and send `DELETE` to the session resource returned in the signaling response's `Location` header.

RealtimeKit continues to provide the contributor room. Stream provides the one-to-many audience broadcast.

The [current Stream WebRTC limitations](https://developers.cloudflare.com/stream/webrtc-beta/#limitations) require WHIP and WHEP together: WHIP broadcasts cannot be recorded by Stream, played through HLS/DASH, or restreamed through RTMP/SRT. Studio therefore records the programme separately in the browser and uploads it to R2 for the existing VOD handoff. Stream live viewer counts are also unavailable for WebRTC.

WebRTC delivery became billable at standard Stream rates on October 15, 2026: currently $1 per 1,000 delivered viewer-minutes. Test streams also use Stream delivery when watched. See [Stream pricing](https://developers.cloudflare.com/stream/pricing/) for current rates.

Programme audio is mixed into one stable track for both WHIP publishing and browser recordings. Contributors can join or leave without adding audio tracks to the broadcast, and stopping either output leaves the contributor microphones running.

Recordings contain the composed programme video and mixed audio only. Isolated recordings (ISOs) of each contributor's camera and microphone are not implemented.

To verify the full path, start a test session from an authorized host or producer room, choose Go live, and check that publishing reaches the live state. Use the returned WHEP playback URL in a compatible player to check audio and video, then choose Stop live and check that publishing stops. Test streams are excluded from the public lineup and do not send notifications. Check the browser recording and R2/VOD handoff separately; Stream WebRTC does not produce a recording.

## Live Verification

Run `bun run verify:live` through the production `cuenv` environment to verify Cloudflare auth, the deployed Worker, session KV, Studio D1 schema, content R2 bucket, and RealtimeKit Secrets Store entries without printing secret values.
