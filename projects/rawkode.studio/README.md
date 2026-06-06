# Rawkode Studio

Astro + Vue Studio for Rawkode live production, low-latency contributor rooms, and recording-first VOD handoff.

## Commands

```sh
bun run dev
bun run check
bun run test
bun run build
```

## Runtime Bindings

- `SESSION`: KV namespace for rawkode.academy identity sessions.
- `STUDIO_DB`: D1 database with `data-model/0000_studio_sessions.sql`.
- `RECORDINGS`: R2 bucket containing Studio recordings and ready markers. Production binds `rawkode-academy-content` so R2 Event Notifications can hand markers to the ingest Worker; the public content Worker denies `studio/recordings/*` while still serving final `videos/*` VOD output.
- `RECORDINGS_BUCKET_NAME`: name of the bound R2 recordings bucket written into ready markers.
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `REALTIMEKIT_APP_ID`: Cloudflare RealtimeKit API configuration.
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

The browser production canvas remains a Vue island inside Astro pages. Hosts, producers, and guests authenticate through `rawkode.academy` identity, where the GitHub handle is the user ID used to attach people metadata.
