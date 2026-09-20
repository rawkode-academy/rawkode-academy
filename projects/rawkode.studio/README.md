# Rawkode Studio

Rawkode Studio is the browser production console for Rawkode live events. It combines a RealtimeKit contributor room, a persisted programme compositor, Cloudflare Stream WebRTC/WHIP publishing, and recording-first VOD handoff.

This is an operator runbook for the current MVP. “Implemented” below means present in this checkout; it does not mean a production dependency has passed its go-live gate.

## Shipped MVP checklist

- [x] GitHub-backed `rawkode.academy` identity and a development-only identity header.
- [x] Content-backed and ad-hoc Studio sessions with test/prod stream intent.
- [x] RealtimeKit host, producer, guest, and program presets with guest invites and durable participant identities for token refresh/rejoin.
- [x] Producer compositor with persisted, revision-checked control state.
- [x] Separate Preview and Programme monitors, explicit Take, basic scene rundown editing, and producer-controlled backstage/on-stage sources. Explicit departure revokes a reappearing durable source ID, and a synchronous frame fence prevents an older asynchronous render from returning a backstage source to Programme. Live browser rehearsal remains required.
- [x] Cloudflare Stream WebRTC/WHIP publishing with a 5-second publisher heartbeat, a 20-second server lease, explicit takeover, and one fresh prod publisher per content video/slug.
- [x] Prod-only public live state and one notification claim after Stream confirms the input is connected.
- [x] Prod-only browser programme recording with a 30-second heartbeat/120-second per-video lease, one immutable canonical VOD claim per content video, durable browser recovery, ready-marker handoff, and identity-checked transcode status.
- [x] Optional contributor-local camera/microphone recording with IndexedDB recovery and download. These files stay in that browser and are not uploaded, synchronized, or attached to the canonical programme recording.
- [x] Public website playback through its `STUDIO` service binding.
- [x] Manager-only control plane for a separate Cloudflare RTMPS/SRT input and its outputs. It requires migration `0009` and an external encoder that captures the Programme monitor; it does not relay the browser WHIP feed.
- [ ] YouTube delivery is not production-supported. No provider call or end-to-end media rehearsal has validated the separate input, external encoder, destination ingest, viewer playback, or rollback. See [platform capabilities and roadmap](docs/platform-capabilities.md#supported-transport-architectures).
- [ ] Every external gate in [External go-live gates](#external-go-live-gates) is verified in the target account.
- [ ] A test-mode dress rehearsal and the prod dry rehearsal have been signed off for the event.

## Roles and access

| Role | Entry point | What it does | Production controls |
| --- | --- | --- | --- |
| Configured operator | `/` | Creates sessions and can manage every session. Handles are set by `STUDIO_OPERATOR_GITHUB_HANDLES`; the default is `rawkode`. | Can open the producer route. |
| Session creator/manager | Dashboard session links | A creator, configured operator, or recorded `host`, `producer`, or `program` participant is a session manager. | Can issue invites, end the session, read/write control state, stream, and record. |
| Host | `/studio/{sessionId}/host` | RealtimeKit green room for camera, microphone, contributors, and an optional personal local recording. | The Host UI does not expose programme switching, live publishing, or programme recording. |
| Producer | `/studio/{sessionId}/producer` | Programme compositor, scene/overlay control, Stream publishing, recording, and handoff status. | Yes. This is the normal live operator role. |
| Program | RealtimeKit participant API/preset | Reserved programme participant preset. There is no dedicated Program navigation route in the MVP. | The Vue console supports the role when embedded, but normal operation uses Producer. |
| Guest | `/guest/{inviteToken}` then the guest room | RealtimeKit green room and optional personal local recording. A content-listed guest can join directly; anyone else needs a valid, unexpired invite. | No programme controls. |

The current authorization boundary is “session manager”, not strict separation between host/producer/program managers. A manager who knows the producer URL can open it. Treat role labels as room/UI responsibilities, not a security boundary.

## Local development

Run the repository sync once before Bun workspace commands, tests, or generated checks:

```sh
cd /path/to/rawkode-academy
cuenv sync -A
cd projects/rawkode.studio
```

Apply the migrations to Wrangler’s local D1 database. This is local-only; `bun run migrate` targets production and must not be used for local setup.

```sh
bun x wrangler d1 migrations apply rawkode-academy-studio \
  --local \
  --config ./wrangler.jsonc
bun run dev
```

Studio listens on `http://127.0.0.1:4323`. Development identity is enabled only when Astro is in development mode and only when every relevant request includes:

```text
X-Dev-Github-Username: rawkode
```

Check the exact local auth contract with:

```sh
curl --fail-with-body \
  --header 'X-Dev-Github-Username: rawkode' \
  http://127.0.0.1:4323/api/auth/me
```

For browser operation, configure a request-header extension or local proxy to add that header only to `http://127.0.0.1:4323/*`. The header accepts a handle with or without `@`, trims it, and lowercases it. Production ignores this header and uses the `rawkode-studio-session` cookie created by the identity PKCE flow.

Useful local checks:

```sh
bun run check
bun run test
bun run build
bun run deploy:dry-run
```

## Production migration and deployment

The production D1 path is forward-only. Export before applying migrations, and never attempt to reverse an applied migration by editing `d1_migrations`.

Canonical VOD rollout is ordered across two independently deployed Workers. First apply the recording-ingest migrations through `0002_event_processing_lease.sql`, deploy that Worker, verify its execution-list permission, and complete a controlled marker rehearsal. Only then apply/deploy Studio and permit a prod recording. The two GitHub workflows can run concurrently for one merge, so workflow success alone does not prove this ordering; do not record while the older ingest consumer is active.

From `projects/rawkode.studio` after `cuenv sync -A`:

```sh
cuenv exec --env production -- \
  bun x wrangler d1 migrations list rawkode-academy-studio \
  --remote --config ./wrangler.jsonc

cuenv exec --env production -- \
  bun x wrangler d1 export rawkode-academy-studio \
  --remote \
  --output /tmp/rawkode-academy-studio-pre-migration.sql \
  --config ./wrangler.jsonc

# Required before 0008: this must return no rows.
cuenv exec --env production -- \
  bun x wrangler d1 execute rawkode-academy-studio \
  --remote --json --config ./wrangler.jsonc \
  --command "SELECT video_id, COUNT(*) AS recording_count, GROUP_CONCAT(recording_id) AS recording_ids FROM studio_recordings GROUP BY video_id HAVING COUNT(*) > 1;"

cuenv exec --env production -- bun run migrate
cuenv exec --env production -- bun run verify:live
```

`verify:live` must report all checks passing before a deployment or event. Then use the normal CI deployment path. For an explicitly approved manual deployment:

```sh
cuenv exec --env production -- bun run deploy
cuenv exec --env production -- bun run verify:live
```

No command in this README is authorization to deploy; follow the repository’s release/approval process.

### Worker rollback

Worker rollback does not roll back D1. The current `0004`–`0009` migrations are additive, so an older Worker can ignore them, but retain the export and review compatibility before rollback. Migration `0008` deliberately fails if the duplicate audit was not clean; do not delete rows merely to make it pass. Migration `0009` adds the separate RTMPS/SRT input claim; applying it does not create a provider input or start media.

Migration `0007` gives any row already in `recording` state with no lease ID an exact 10-minute rollout grace from migration time. During that grace, a new recording receives HTTP 409, while the first part, completion, abort, or heartbeat from the pre-deploy recording adopts its recording ID and begins the normal 120-second lease. If it sends nothing before the grace expires, the next create expires that legacy row and may claim the session. Do not manually clear these columns during rollout.

```sh
cuenv exec --env production -- \
  bun x wrangler versions list --config ./wrangler.jsonc --json

cuenv exec --env production -- \
  bun x wrangler rollback <known-good-version-id> \
  --config ./wrangler.jsonc \
  --message 'Studio incident rollback'

cuenv exec --env production -- bun run verify:live
```

Record the failed version, rollback version, event/session ID, incident time, and operator before changing anything else.

## Read-only production verification

Run:

```sh
cuenv exec --env production -- bun run verify:live
```

The verifier performs only list/info/status/GET operations and a D1 `SELECT`. It does not deploy, apply migrations, create a live input, intentionally retrieve Secrets Store values, write R2 objects, or send a queue message. Cloudflare live-input GET response schemas can include RTMPS/SRT ingest credentials even for a read operation. The verifier parses only the API envelope and collection shape needed for the check; it does not log, print, or persist provider payloads, and failures expose controlled metadata only.

It checks:

1. Wrangler authentication and an active Studio Worker deployment.
2. `https://rawkode.studio/` and the unauthenticated `/api/auth/me` contract.
3. The session KV namespace and Studio D1 database identity.
4. All migrations `0000`–`0009`, the control-state table/revision/index, stream lease column/index, recording lease ID/heartbeat/grace/index, the unique canonical-recording index, a clean duplicate audit, durable RealtimeKit participant identity column/index, and the separate output-input table/mode/state index.
5. Read access to the content R2 bucket.
6. Presence of all three Secrets Store entries without reading their values.
7. The actual deployed Worker’s KV, D1, R2, Queue, and Secrets Store bindings.
8. Notification queue visibility.
9. A RealtimeKit app containing all four required preset names.
10. Cloudflare Stream live-input read authorization.

The production `CLOUDFLARE_API_TOKEN` therefore needs read access for Workers, KV, D1, R2, Queues, RealtimeKit, and Stream. Runtime RealtimeKit and Stream tokens remain separate Secrets Store values.

## Event preflight

Complete this in order. Stop if any required check fails.

### Technical preflight

1. Run `verify:live`; require every line to pass.
2. Confirm there is no unexpected active publisher:

   ```sh
   cuenv exec --env production -- \
     bun x wrangler d1 execute rawkode-academy-studio \
     --remote --json --config ./wrangler.jsonc \
     --command "SELECT id, title, stream_environment, stream_status, stream_heartbeat_at FROM studio_sessions WHERE stream_status IN ('starting', 'live');"
   ```

3. Confirm the event has a content video ID and slug. A prod stream without content backing is rejected.
4. Confirm no other prod Studio session for that content video/slug is starting or live. The start claim rejects duplicates atomically; test-mode sessions may still run in parallel.
5. Confirm the content video has no existing `studio_recordings` row and no existing `videos/{videoId}/transcode-status.json` or `videos/{videoId}/stream.m3u8` object unless this is an exact retry of the same recording/source tuple. A canonical claim is permanent.
6. Confirm the public website deployment has its `STUDIO` service binding and the watch page resolves the same video slug.
7. Confirm the RealtimeKit app has the four configured presets and the runtime token can create meetings/participants.
8. If YouTube is required, stop unless the separate RTMPS/SRT path has already passed its end-to-end rehearsal for this event profile. Require migration `0009`, a session-bound input on the **Outputs** page, an external encoder capturing the Programme monitor, confirmed RTMPS/SRT ingest, a create-disabled destination that an operator deliberately enables, independent viewer playback, and rehearsed stop/disable controls. The browser WHIP input remains separate and cannot restream.
9. Confirm the notifications Queue consumer and R2 recording-ingest consumer are healthy. Binding visibility alone does not prove delivery.

### Operator and browser preflight

1. Use a current Chromium browser on a wired connection where possible. Grant camera, microphone, screen-capture, and autoplay permissions.
2. Keep the Producer tab foreground-capable and the machine awake. The publisher renews every 5 seconds and is considered stale after 20 seconds; three consecutive heartbeat failures stop the local publisher.
3. Keep only one recording Producer active for a content video. Recording renews its server lease every 30 seconds and loses ownership after 120 seconds without a successful heartbeat; another prod session for the same video receives a controlled conflict. Different videos may record concurrently.
4. Confirm sufficient browser storage and disk space. Recording uses IndexedDB as a durable backup before R2 completion.
5. Assign one primary Producer and one takeover operator with an out-of-band voice/text channel.
6. Join every host/guest, verify names and roles, keep new sources backstage, preview and explicitly admit each source, check programme audio, and rehearse mute, return-to-backstage, leave/rejoin, screen-share, transition, and Take changes. Require no backstage picture, stale frame, or sound in Programme.
7. Open the session’s Recordings page in a separate tab for handoff observation; do not use it as the active producer tab.

## Rehearsals

### Test-mode dress rehearsal

Test mode still creates/uses real Cloudflare Stream resources, but recording is local-only. It never creates a multipart R2 upload, writes a ready marker, claims canonical VOD output, publishes public website live state, or enqueues the prod-live notification.

1. Create a content-backed session with `streamEnvironment: test`.
2. Join from separate browser profiles as Producer, Host, and at least one Guest.
3. Exercise camera, microphone, screen share, Preview/Take, scene CRUD, overlays, explicit admit/return-to-backstage, leave/rejoin, control-state refresh, and a second producer’s state view. Prove no backstage picture or sound reaches Programme during a transition.
4. Start recording, wait for the red recording state, then click **Go live**.
5. Require the state sequence **Starting live stream** → **Confirming stream** → **Test stream live**.
6. Verify Cloudflare playback, remain live for at least two lease windows (40 seconds), and exercise one deliberate takeover.
7. Click **Stop live**, then stop recording. Require the local WebM download before closing the tab.
8. Confirm the Recordings page remains unchanged and no `studio_recordings` row, ready marker, or canonical `videos/{videoId}/` output was created.

If external distribution is in scope, use an isolated test session and destination.
From the session **Outputs** page, provision the separate input, reveal ingest
credentials only while configuring the encoder, capture the Programme monitor,
add the destination disabled, then enable it deliberately. Verify ingest and
viewer playback independently, disable the destination, stop the encoder, and
confirm Rawkode WHIP playback and browser recording were isolated throughout.
Never paste ingest credentials or destination keys into the rehearsal record.

### Prod dry rehearsal

Prod confirmation is not private: it publishes public live state and claims a notification. Do not use **Go live** during a dry rehearsal.

1. Create or inspect the actual content-backed prod session and confirm title, show, start time, content video ID, and slug.
2. Join every contributor and complete the same green-room/source/audio checks as test mode.
3. Confirm the public watch URL, notification audience, and incident contacts. If YouTube is required, confirm the separately provisioned RTMPS/SRT input, external encoder, destination, playback, and rollback have passed an end-to-end rehearsal. The WHIP input cannot provide that path.
4. Do not make a disposable prod recording: the first prod handoff permanently claims the content video’s canonical VOD output. Validate mechanics in test mode and record the actual programme only when the event owner is ready to keep it.
5. Leave the session scheduled, with `stream_status` not `starting` or `live`.

## Go-live procedure

1. Primary Producer opens `/studio/{sessionId}/producer`; takeover operator opens it but does not click **Go live**.
2. Confirm the session says `Prod` and the programme canvas/audio are correct. If YouTube is required, stop unless the separate RTMPS/SRT input, external encoder, destination, playback, and rollback passed the event rehearsal; the WHIP input cannot deliver YouTube.
3. Click **Record** first when a programme recording is required. Confirm the recording state before publishing.
4. Click **Go live** once. Do not retry while the UI says starting or confirming.
5. Require **Prod stream live**. That state is reached only after Cloudflare reports the live input connected; it also makes the content-backed session public and claims the one prod notification.
6. Verify Cloudflare WHEP playback and the Rawkode watch page independently. If an approved separate distribution path is in use, also verify its source input and YouTube Live Control Room/viewer playback independently.
7. Monitor the producer heartbeat, programme audio, recording state, website playback, and notification/ingest systems for the event. If an approved separate distribution path is in use, monitor its gateway, input, and YouTube health separately.
8. At the end, disable/stop any separately approved distribution path according to its runbook, click **Stop live**, then **Stop** recording. Verify both provider paths have ended and wait for the recording handoff result before ending the Studio session or closing the producer tab.

## Takeover and forced stop

### Planned takeover

1. Contact the active Producer out of band. Takeover intentionally interrupts the current publisher.
2. On the standby Producer, click **Go live**. An active lease returns a conflict and changes the button to **Take over live**.
3. Click **Take over live** once. Studio ends the old lease, waits 6 seconds for the previous WHIP publisher to disconnect, and starts a new publisher.
4. The old Producer stops when its next heartbeat is rejected. Require the standby UI to reach the expected test/prod live state and re-check every playback destination.

### Forced stop

Use these in order:

1. If the owner UI responds, click **Stop live**.
2. If the owner is gone but another Producer can operate, take over, wait for the new publisher to connect, then click **Stop live**.
3. To end the lease without automatically starting a replacement, a signed-in session manager can run this in DevTools on `https://rawkode.studio`:

   ```js
   await fetch("/api/studio/stream", {
     method: "POST",
     credentials: "same-origin",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ action: "takeover", sessionId: "<session-id>" }),
   }).then(async (response) => ({
     body: await response.json(),
     status: response.status,
   }));
   ```

   A successful response marks the server lease ended. The previous browser should stop after the rejected heartbeat.

4. If Studio is unavailable and media is still leaving the WHIP path, disable the affected WebRTC live input in Cloudflare. If an approved separate RTMPS/SRT distribution path is also active, stop or disable that path through its rehearsed control. Do not delete either input during an incident; preserve identifiers and recordings for diagnosis.
5. After recovery, query the session state, require `stream_status = 'ended'`, verify public playback is gone, and record whether a notification had already been queued. Do not manually clear notification state or edit D1 as a first response.

## Recording recovery

### Normal and upload-failure recovery

- Never close or reload the Producer tab while it says recording, saving, or uploading.
- On success, the UI shows `Uploaded <recordingId>` and the Recordings page tracks `uploaded`, `transcoding`, `vod-ready`, or `failed`.
- Multipart completion is retry-safe only for the exact immutable tuple: video ID, Studio session ID, recording ID, source bucket/key/ETag/format, and output prefix. If Cloudflare completed the source but its response, D1 write, or ready-marker write failed, the retry verifies and republishes that same tuple without calling multipart completion again.
- A different recording or source for an already-claimed video receives `recording-output-claimed` with HTTP 409. Studio does not update the existing row, marker, session status, or canonical output. Transcode status is attributed only when its complete identity tuple matches the D1 recording.
- Abort checks for the completed source before and after abort. If the source already exists, Studio returns a recovered handoff instead of setting the session idle or deleting the completed path.
- If multipart upload fails while the tab is alive, Studio aborts only the incomplete upload and starts a local `rawkode-studio-program-<timestamp>.webm` download. The IndexedDB copy remains available until an operator explicitly discards it.
- A second Producer tab or prod session for the same content video receives `Another Studio recording is already active for this content video.` with HTTP 409. If the active tab loses its 120-second lease, it stops recording/upload work and retains its browser recovery copy; it must not clear a newer tab’s lease.

### Canonical VOD break-glass

The one-recording claim is intentionally permanent. There is no UI reset, replacement upload, or safe “try another take” path. Do not delete the D1 row, ready marker, transcode status, or `stream.m3u8` to bypass `recording-output-claimed`.

If the claimed output is wrong or unusable, preserve the pre-migration export, browser backup, source object, marker, status document, recording/session IDs, and incident timeline. The default recovery is to create a new content video ID and explicitly repoint editorial metadata after review. Any in-place repair of the original video ID is a data migration requiring incident-owner approval, a provenance audit across D1/R2/ingest, a fresh backup, and a written forward-only plan; it is not an event-time operator action.

### Browser-crash recovery

The Producer’s **Recording recovery** panel lists durable IndexedDB backups after reload or browser restart, including finalized/incomplete state and integrity information. Keep the original browser profile and do not clear site data. Use **Download** to produce a recovery WebM; downloading does not delete the browser copy. Use **Discard** only after the server handoff or downloaded file has been verified, because discard is explicit and irreversible.

Studio removes a browser backup automatically only after a verified normal or recovered server handoff. Local fallback downloads, true multipart aborts, media failures, and lease loss retain the backup until explicit discard. If the panel shows no artifact, check the session Recordings page and the R2/ingest incident trail before declaring the recording lost.

## External distribution rollback

The current Studio publisher is WHIP-only. Cloudflare documents that WebRTC/WHIP inputs cannot use RTMP/SRT simulcast outputs, so the Studio live input cannot own a working YouTube output. Studio can now provision and control a separate RTMPS/SRT input, but an external encoder must capture Programme and publish to it. That path remains unsupported for production until it is deployed and rehearsed end to end.

For a separately provisioned and rehearsed path:

1. Stop or disable the separate distribution output/input using its rehearsed server-side control. Do not alter the Studio WHIP input when Rawkode playback is healthy.
2. In YouTube Live Control Room, verify ingest has stopped. End the YouTube broadcast only if the event plan calls for it.
3. If the source programme is also unsafe, use **Stop live** or the forced-stop procedure for the WHIP path as well.
4. Preserve the distribution input/output ID, target URL, incident time, and YouTube broadcast ID. Never paste a stream key or WHIP publish URL into chat, logs, tickets, or this repository.
5. Re-enable distribution only after the gateway/input and viewer playback are healthy in test resources and the incident owner approves the retry.

If the **Outputs** page reports that provisioning needs reconciliation, preserve
the D1 claim and stop retrying. An unknown Cloudflare create outcome is stored as
`uncertain` so a retry cannot create a duplicate unmanaged input. Inspect
Cloudflare live inputs for metadata `studioSessionId=<session-id>` and
`studioPurpose=external-encoder-outputs`, then determine whether the provider
input exists before taking any action. Do not blindly delete a provider input,
clear the D1 row, or provision again. Record the candidate input IDs and provider
request time and have the incident owner reconcile the exact resource.

Cloudflare live-input GET responses can expose RTMPS/SRT ingest credentials, and output responses can expose destination keys. Ordinary Studio responses project allowlisted secret-free fields and suppress provider payloads from logs and errors. The explicit manager-only credentials action is the sole browser response containing ingest secrets and uses `Cache-Control: no-store`; treat the visible values as transient operator credentials.

## Incident quick reference

| Symptom | First response | Escalation/rollback |
| --- | --- | --- |
| RealtimeKit room cannot start | Stop the event path; check verifier app/preset visibility and Secrets Store bindings. | Confirm runtime RealtimeKit token permissions and preset configuration. |
| Stream remains starting/confirming | Click **Stop live** once; check browser network/WHIP and Stream read auth. | Rehearse in test mode; do not force prod state in D1. |
| “Stream already active” | Contact the owner and use planned takeover. | Use forced stop only when ownership is lost. |
| “Another prod Studio session is already publishing this content” | Find the other session for the same content video/slug and stop or let its stale lease expire. | Do not bypass the atomic claim or edit D1; test sessions remain available for rehearsal. |
| Studio says prod live but watch page is not live | Verify content slug/environment and website `STUDIO` service binding. | Stop prod, fix the external gate, and repeat test rehearsal. |
| YouTube is wrong but Rawkode playback is healthy | Stop or disable only the separate RTMPS/SRT distribution path. The Studio WHIP input cannot own that output. | Follow external distribution rollback; keep Rawkode playback and the separate Studio browser recording alive if safe. |
| Output provisioning needs reconciliation | Stop retrying and preserve the D1 claim. Search Cloudflare inputs by the session/purpose metadata and determine whether the create succeeded. | Do not clear D1 or blindly delete/recreate provider resources; reconcile the exact input with an incident owner. |
| Notification missing | Record whether `stream_notification_queued_at` is set and inspect the Queue consumer. | Do not manually resend until idempotency/audience impact is reviewed. |
| Recording conflict or lease loss | Stop using the stale tab; keep its browser recovery copy and identify the current recording owner. | Download from Recording recovery; never clear D1 to make the stale tab win. |
| Recording upload/transcode fails | Keep the tab open; preserve the IndexedDB recovery copy, local WebM, and recording ID. | Use the Recording recovery panel or investigate R2 event/ingest/Cloud Run. |
| New Worker deployment regresses | Stop/take over active media safely, capture the version ID. | Roll back the Worker; do not roll back D1. |

## External go-live gates

| Gate | Required state | Covered by `verify:live` |
| --- | --- | --- |
| cuenv toolchain | The shared CI contributor must resolve a reviewed, explicitly pinned cuenv release. The current generated bootstrap follows `releases/latest`, so production release approval remains blocked until the shared contributor or generator supports and uses a pin. | No. Confirm the generated workflow and bootstrap asset before every release. |
| Rawkode identity | OAuth client `rawkode-studio`, callback URL, session KV, and GitHub handle claims work. | KV and unauthenticated route only; interactive login is manual. |
| RealtimeKit | One app contains the host/producer/guest/program presets; runtime token can create meetings and participants. | App/preset visibility and secret bindings; write capability needs a rehearsal. |
| Cloudflare Stream | Runtime token can create/read live inputs and manage outputs; browser network permits WHIP/WHEP. Migration `0009` and its output-input table/mode/state index are present. | Deploy-token read capability, binding, and schema only; provisioning, publishing, output mutation, and playback need isolated test resources. |
| YouTube | A separate RTMPS/SRT input and external encoder are deployed, the destination starts disabled, ingest/viewer playback are correct, and an owner can disable it independently. A Cloudflare output attached to the WHIP input is unsupported. | No. Validate end to end without exposing the key. |
| Content GraphQL | The event resolves to the expected content video ID, slug, hosts, and guests. | No. Required for prod. |
| Public website | Website Worker has the `STUDIO` service binding and the watch page renders WHEP playback. | Studio endpoint only; website deployment/playback is manual. |
| Notifications | `rawkode-academy-notifications` exists, Studio is bound as producer, and its consumer is healthy. | Queue and producer binding; consumer delivery is manual. |
| Recording ingest | R2 Event Notification reaches `studio-recording-ingest`; migrations `0001`–`0002`, leased event recovery, deterministic Cloud Run dispatch reconciliation, runtime `run.jobs.runWithOverrides`/`run.executions.list`, transcoding, and status markers are verified. | R2/binding only; ordered deployment, runtime execution-list permission, event delivery, and transcoding need rehearsal. |
| Browser/operator | Supported Chromium, permissions, storage, stable uplink, primary and standby operators, incident backchannel. | No. |

No prod event is ready while any required gate is unknown.

## Runtime binding reference

- `SESSION`: KV namespace for Rawkode identity sessions.
- `STUDIO_DB`: D1 database with migrations in `data-model/`.
- `RECORDINGS`: private Studio source recordings and ready markers in `rawkode-academy-content`.
- `RECORDINGS_BUCKET_NAME`: source bucket name written into ready markers.
- `CLOUDFLARE_ACCOUNT_ID`: account that owns RealtimeKit and Stream.
- `CLOUDFLARE_STREAM_API_TOKEN`: Secrets Store runtime token used by Studio to create/read Stream live inputs and manage outputs.
- `STREAM_NOTIFICATIONS`: producer binding to `rawkode-academy-notifications`; used only after a prod stream is confirmed live.
- `REALTIMEKIT_API_TOKEN`, `REALTIMEKIT_APP_ID`: Secrets Store runtime configuration.
- `REALTIMEKIT_*_PRESET`: participant preset names.
- `RAWKODE_GRAPHQL_URL`: content gateway, default `https://api.rawkode.academy/`.
- `STUDIO_OPERATOR_GITHUB_HANDLES`: comma-separated session operators.

Recording source objects use `studio/recordings/{sessionId}/{recordingId}/source.webm`; ready markers use the same prefix plus `ready.json`. Content-backed VOD publishes under `videos/{videoId}/`. Ad-hoc sessions cannot use persistent recording upload or prod streaming because both require a content video.

Provider references: [Wrangler D1 commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/), [RealtimeKit API](https://developers.cloudflare.com/api/resources/realtime_kit/), [Stream WebRTC limitations](https://developers.cloudflare.com/stream/webrtc-beta/#limitations), [Stream RTMPS/SRT live inputs](https://developers.cloudflare.com/stream/stream-live/start-stream-live/), [Stream simulcast outputs](https://developers.cloudflare.com/stream/stream-live/simulcasting/), and [Cloudflare live-input GET schema](https://developers.cloudflare.com/api/resources/stream/subresources/live_inputs/methods/get/).
