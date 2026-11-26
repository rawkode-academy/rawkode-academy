# YouTube sync

A Cloudflare Worker that keeps the Rawkode Academy channel's video metadata in line with the Academy catalogue. It is the only thing that writes to YouTube. The read-only analytics Worker (`youtube-control`) has its own credential and stays read-only.

The site is the source of truth and the direction is one way: Academy to YouTube. Nothing is ever written back into the Academy's D1 databases.

## What it manages

The site owns the video. Studio text never wins: whatever the site generates is written, and the previous values are kept so a write can be rolled back.

| Field | How |
| --- | --- |
| Title | The site's title. Over 100 characters it is cut at a word with an ellipsis; `<` and `>` are removed. |
| Description | Generated: a header (the watch link), the site's description as plain text, the chapters, then a footer (newsletter, supporter link and, for a collaboration, a disclosure line). The body is cut at a paragraph, a sentence or a word, never mid-word, so the whole stays under YouTube's 5,000 bytes. Chapters are listed only in the shape YouTube accepts (starting at 0:00, at least three, ten seconds apart); a list that starts later gets an "Intro" at 0:00. |
| Thumbnail | The site's WebP, converted to a 1280x720 JPEG with the Images binding (under 2 MB) and set with `thumbnails.set`. The source image's hash says when it changed, so a thumbnail is pushed once and again only when the site's image changes. The image YouTube showed before is stored in D1 for rollback. |
| Tags, category, language, privacy, schedule | never touched: `videos.update` replaces the whole snippet, so every write starts from the live snippet and sends it back with only the title and description changed. |

`MANAGED_FIELDS` in `wrangler.jsonc` (`title,description,thumbnail`) turns each on or off. Course-only videos are excluded (they plan as `SKIP`), as are videos with no YouTube mapping.

## Plan, apply, rollback

Every change goes through a plan you can read first.

1. **Plan** (`POST /plan`, daily at 09:47 UTC, or run the `rawkode-academy-platform-youtube-sync-plan` workflow). The daily run also queues up to `AUTO_APPLY_LIMIT` (80, in `wrangler.jsonc`) of the plan's changes for writing, which is about a day's quota, so a site change reaches YouTube within a day or two with no one running anything. `0` makes the cron plan-only. Reads the live snippets (1 quota unit per 50 videos), compares them to what the site wants, and stores a plan in D1 with a diff per video. The report is in the workflow's job summary and at `GET /plans/<id>/report`. Nothing is written to YouTube. Each video is one of:
   - `CHANGE`: the live title, description or thumbnail differs from what the site wants. If someone edited it in Studio since the last sync, the reason says it will be overwritten.
   - `NOOP`, `SKIP` (not listed, course-only, unmapped, private or deleted), `ERROR` (cannot be sent as is).
   The job summary also shows the full, untruncated change for the first video named in `apply.json` (else the first in the plan), and `GET /plans/<id>/videos/<slug>` returns any video's.
2. **Apply** (the `rawkode-academy-platform-youtube-sync-apply` workflow). Queues `CHANGE` items from the latest plan, as `apply.json` allows. Before each write it re-reads the live fields and refuses the video if they changed since the plan (`stale`), so the diff you reviewed is the diff that is written.
3. **Rollback** (`POST /rollback`). Puts back the logged before values for a plan or one video, unless the field was edited after the sync wrote it.

### The daily schedule, and `apply.json`

The daily cron's standing approval is `AUTO_APPLY_LIMIT`; changing it is a commit like any other. `apply.json` is the manual approval for a bigger or targeted run:

```json
{ "planId": "latest", "limit": 1, "videos": [], "dryRun": true }
```

It ships as a dry run of one video. To roll out, change it in a commit and run the apply workflow:

1. `dryRun: false`, `limit: 1`, `videos: ["<slug>"]`: the canary. Look at the video in Studio.
2. `limit: 10`, then a large `limit` (up to 400): the queue works through them within each day's quota and carries on the next day by itself, so one apply is enough.

The commit is the record of who allowed what.

## Pushing when the site changes

The `video-updates` Worker publishes `video.updated` to the queue `platform-video-updated` once it has committed a change to a video. This Worker re-reads that one video, plans it (scope `video`, so it never becomes the "latest" plan) and, if the title, description or thumbnail differ, writes it straight away, ahead of anything waiting on the write queue below. The last 1,000 units of the daily budget (`UPDATE_RESERVE`) are kept for these writes: bulk writes stop at 8,000, update events may use up to 9,000. If YouTube's quota is gone the write is re-sent on the write queue (with priority) after the reset. The daily plan stays as the safety net. Set `PUSH_ON_UPDATE` to anything but `true` to ignore these events; failures land in `platform-video-updated-dlq` and `deadLetters` like any other.

## Quota and the queue

YouTube gives 10,000 units a day, resetting at midnight Pacific. A `videos.update` costs 50, a `thumbnails.set` 50 and a `videos.list` 1. The Worker counts units per Pacific day in D1 and stops at 9,000, leaving 1,000 for the analytics sync. A full video is about 101 units, so a day writes about 89 videos and the first push of ~330 takes four days.

Apply doesn't write inline. It puts one message per video on the Cloudflare Queue `platform-youtube-sync` (as many as `apply.json` allows), and the Worker's consumer writes them one at a time (`max_concurrency: 1`, so the quota count is exact):

- **Success, stale (edited since the plan) or missing:** acknowledged.
- **Quota exhausted** (a 403 whose reason is `quotaExceeded`, or the 9,000 budget): not a failure. The day is marked spent and the message is re-sent with a delay that runs past the Pacific reset (at most 12 hours per hop, as Queues allow), so the batch resumes by itself the next day with no one re-running anything. A message still refused after 8 resets is recorded as stuck.
- **Transient error** (network, timeout, 408, 429, 5xx): retried with exponential backoff, 30 s, 1 m, 2 m ... capped at 15 m, up to `max_retries: 6`, then it goes to the dead-letter queue `platform-youtube-sync-dlq`.
- **An error retrying can't fix** (a rejected image, a permission 403, bad input): recorded straight away.

Anything the queue gives up on is recorded in D1 (`youtube_sync_dead`), logged with `"operation":"queue"` to Grafana, and counted in `GET /status` as `deadLetters`. The daily `youtube-sync-monitor` workflow opens a GitHub issue while `deadLetters` is above zero; it clears itself once that video is written successfully. A redelivered message is safe: a video already written is skipped, and a thumbnail already pushed is not pushed again (which would also overwrite its saved before-image).

Both queues are created by the CI deploy if missing, and the bindings and consumers are in `wrangler.jsonc`. Rollback stays synchronous (it is one deliberate batch).

## Audit

Every write attempt is a row in `youtube_sync_log` with the full before and after snippet. Each write also sends a `youtube.sync.write` CloudEvent (source `rawkode-academy-youtube-sync`) to the analytics lake with the plan id, video id, fields and result, and no text.

## Credentials

`YOUTUBE_SYNC_CLIENT_ID`, `YOUTUBE_SYNC_CLIENT_SECRET`, `YOUTUBE_SYNC_REFRESH_TOKEN` (scope `youtube.force-ssl`) and `SYNC_ADMIN_TOKEN` (the bearer token CI uses to call `/plan`, `/apply` and `/rollback`) live in Infisical at `/projects/rawkode-academy/platform/youtube-sync`. `cuenv task consent` writes them; nothing else does. Secrets reach the Worker only through the CI deploy (`wrangler deploy --secrets-file`). No laptop deploys.

## Going live (once)

1. Apply `infrastructure/bootstrap` (`cuenv infrastructure apply`): it creates the Infisical folder and lets the CI identity read it.
2. `cuenv task consent` in this directory. Google consent in the browser: pick the Rawkode Academy channel. It checks the grant is for exactly that channel, writes the four secrets (and creates the admin token once), and starts the deploy. The OAuth consent screen must be Internal or published to Production, or refresh tokens die after seven days. It reuses the Desktop OAuth client from `youtube-control`, so that client's project needs YouTube Data API v3 enabled, which it already has.
3. Merge. CI applies the D1 migration and deploys. Run the plan workflow and read the report.
4. Walk `apply.json` up as above.

When the monitor issue or a log says `reauthorization_required`, repeat step 2.

## Endpoints

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | none | Process health. |
| `GET /status` | none | Latest plan's counts and time, last write result, quota used today, `deadLetters`. No titles or descriptions. |
| `POST /plan` | bearer | Read-only plan. |
| `GET /plans/<id\|latest>/report` | bearer | Markdown diff report. |
| `POST /apply` | bearer | `{ planId, limit, videos?, dryRun? }`. Enqueues the selected videos (a dry run only lists them). |
| `POST /rollback` | bearer | `{ planId \| youtubeId, limit }`. |

`.github/workflows/youtube-sync-monitor.yml` reads `/status` daily and opens an issue if the plan stopped running, or found drift or errors.

## Verify locally

```sh
cuenv task check
cuenv task test
```

`test` builds the Worker and runs unit tests, D1 tests of plan, apply, drift, stale refusal, quota and rollback under Miniflare, and an end-to-end test through the built Worker with Google, the Academy API and the collector mocked. The service is excluded from the root Bun workspaces and has its own npm lockfile.
