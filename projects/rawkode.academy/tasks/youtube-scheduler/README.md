# YouTube session scheduling

Create and update upcoming livestreams through YouTube's official API. The CLI
supports titles, descriptions, start/end times, JPEG/PNG thumbnails, and binding
an existing encoder stream. It never starts a broadcast, rotates stream keys,
uploads a recording, or modifies the Academy database.

Requires Node.js 22+ (no npm dependencies). Initial authorization uses Python
3.11+ and Google's OAuth library through `uv`.

## Authorize once

Enable YouTube Data API v3 in your Google Cloud project, configure the OAuth
consent screen, and create a **Desktop app** OAuth client. Download its client
JSON outside the repository. Use your own project, not credentials extracted
from a browser or another connector.

Run this on the desktop where you will open the consent browser:

```sh
uv run authorize.py \
  --client-secrets /secure/path/client-secrets.json \
  --channel UCrber_mFvp_FEF7D9u8PDEA \
  --output /secure/path/academy-youtube.credentials.json
export YOUTUBE_CREDENTIALS_FILE=/secure/path/academy-youtube.credentials.json
```

Choose Rawkode Academy's channel/Brand Account during consent. The helper uses
Google's PKCE desktop flow, checks the channel, and saves a refresh credential
with mode `0600`. The requested `youtube.force-ssl` scope permits account writes;
Google's consent screen is the authorization step. Later runs refresh short-lived
access tokens without Studio. Never put credential contents in a manifest, PR,
chat, or log. Keep the credential and durable state files in private storage.

External OAuth apps left in **Testing** normally receive refresh tokens that
expire after seven days for this scope. Configure the appropriate production
consent setup for ongoing use. Revocation and expiry still require reauthorization.

## Preview, apply, verify

```sh
node youtube.mjs validate examples/atuin.json
node youtube.mjs plan examples/atuin.json --state /secure/state/atuin.state.json
node youtube.mjs apply examples/atuin.json --state /secure/state/atuin.state.json
node youtube.mjs verify examples/atuin.json --state /secure/state/atuin.state.json
```

`validate` is offline. `plan` lists exact intended writes without changing YouTube
or state. `apply` publishes them and reads the broadcast back. Review the target
channel, broadcast, and values before applying. `verify` compares current metadata
with the session file. A thumbnail upload acknowledgment is reported separately
from visual verification: inspect the resulting YouTube page after upload.

The Atuin example targets the **existing** `hpgBHtSgBUw` broadcast and only changes
its description. It is a proposed update, not evidence that the update was applied.

For a new session:

```json
{
  "sessionId": "stable-academy-video-id",
  "channelId": "UCrber_mFvp_FEF7D9u8PDEA",
  "title": "Session title | Rawkode Live",
  "descriptionFile": "description.txt",
  "scheduledStartTime": "2027-06-17T17:00:00+01:00",
  "scheduledEndTime": "2027-06-17T18:15:00+01:00",
  "privacyStatus": "public",
  "madeForKids": false,
  "thumbnailFile": "thumbnail.jpg"
}
```

Dates above are examples. Use an explicit timezone offset for the actual event;
17:00 London is 16:00 UTC during BST and 17:00 UTC during GMT. Guest setup time is
separate from public start. Thumbnail and description paths are relative to the
session JSON. Add `streamId` only when you intend to bind that existing encoder.
No stream ID means the listing may still need encoder setup.

An update manifest can contain only `sessionId`, `channelId`, `broadcastId`, and
the fields to change. Omitted fields are preserved. An empty description clears
it. Existing visibility and audience settings are checked if supplied; changing
those settings is intentionally outside this CLI. This tool operates on upcoming
broadcasts only, not active streams or completed recordings.

## Recovery and state

- Reuse the same durable state file for the session. Its broadcast ID survives
  title/time changes and later thumbnail/binding failures.
- Before creating, the CLI searches all owned broadcasts and checks exact title
  and start time. Multiple matches require an explicit ID.
- It journals intent before creation. If a request times out, the next run tries
  to find the broadcast. If no match appears, it stops. Inspect YouTube and supply
  the confirmed ID; do not delete the journal merely to retry creation.
- A missing known ID fails instead of creating a replacement. A state file for
  another channel/session also fails.
- A local lock serializes applies using the same state path. Use one operator or
  job with shared durable state; this is not a distributed lock across machines.
  After a process crash, check that no apply is running before removing its lock.
- API writes are never automatically retried. Read back after a partial failure.
  The CLI preserves untouched snippet fields and sends only the `snippet` update
  part, so unrelated stream, visibility, audience, and monetization settings remain.
- After verification, link the returned broadcast ID to the existing Academy
  video using the scheduling skill's content/cache procedure.

## Tests and references

From the repository root, run `cuenv sync -A`, then:

```sh
node --test projects/rawkode.academy/tasks/youtube-scheduler/youtube.test.mjs
```

Tests use a fake API, including response loss after successful creation, partial
thumbnail failure, pagination, ownership errors, and concurrent apply. They do
not create test broadcasts or exercise a real OAuth grant.

Official references checked 2026-10-31:

- [Create broadcast](https://developers.google.com/youtube/data/live/reference/rest/v3/liveBroadcasts/insert)
- [Update broadcast](https://developers.google.com/youtube/data/live/reference/rest/v3/liveBroadcasts/update)
- [List broadcasts](https://developers.google.com/youtube/data/live/reference/rest/v3/liveBroadcasts/list)
- [Bind stream](https://developers.google.com/youtube/data/live/reference/rest/v3/liveBroadcasts/bind)
- [Upload thumbnail](https://developers.google.com/youtube/data/reference/rest/v3/thumbnails/set)
- [Google desktop OAuth library](https://googleapis.dev/python/google-auth-oauthlib/latest/reference/google_auth_oauthlib.flow.html)
- [OAuth token expiry](https://developers.google.com/identity/protocols/oauth2/)
