# YouTube sync

A Cloudflare Worker that keeps the Rawkode Academy channel's video metadata in line with the Academy catalogue. It is the only thing that writes to YouTube. The read-only analytics Worker (`youtube-control`) has its own credential and stays read-only.

The site is the source of truth and the direction is one way: Academy to YouTube. Nothing is ever written back into the Academy's D1 databases.

## What it manages

| Field | Managed | How |
| --- | --- | --- |
| Description | yes, **footer only** | Everything from the line `──── Rawkode Academy ────` to the end is the site's: the watch link (with `utm_source=youtube`), newsletter, supporter link and, for a collaboration, a disclosure line. Text above the marker is written in Studio and never touched. |
| Title | built, **off** | Turn it on with `MANAGED_FIELDS` in `wrangler.jsonc` (`"title,description"`). Titles over 100 characters or containing `<` or `>` fail that video; they are never truncated. |
| Thumbnails | not yet | `thumbnails.set` takes JPEG or PNG up to 2 MB, and ours are WebP in R2, so this needs an image-conversion step. It is a follow-up. |
| Tags, category, language, privacy, schedule | never | `videos.update` replaces the whole snippet, so every write starts from the live snippet and sends it back with only the managed fields changed. |

Course-only videos are excluded (the Academy API's default `getAllVideos` leaves them out, so they plan as `SKIP`), as are videos with no YouTube mapping.

## Plan, apply, rollback

Every change goes through a plan you can read first.

1. **Plan** (`POST /plan`, daily at 09:47 UTC, or run the `rawkode-academy-platform-youtube-sync-plan` workflow). Reads the live snippets (1 quota unit per 50 videos), compares them to what the site wants, and stores a plan in D1 with a diff per video. The report is in the workflow's job summary and at `GET /plans/<id>/report`. Nothing is written to YouTube. Each video is one of:
   - `CHANGE`: the live fields are what the sync last wrote (or first saw), and the site wants something else.
   - `DRIFT`: someone edited the fields in Studio since. Reported and **not overwritten** unless named in `overrides`.
   - `NOOP`, `SKIP` (not listed, course-only, unmapped, private or deleted), `ERROR` (cannot be sent as is).
   The first plan adopts the live values as the baseline: nothing is treated as drift on day one.
2. **Apply** (the `rawkode-academy-platform-youtube-sync-apply` workflow). Applies `CHANGE` items from the latest plan, as `apply.json` allows. Before each write it re-reads the live fields and refuses the video if they changed since the plan (`stale`), so the diff you reviewed is the diff that is written.
3. **Rollback** (`POST /rollback`). Puts back the logged before values for a plan or one video, unless the field was edited after the sync wrote it.

### `apply.json` is the approval

```json
{ "planId": "latest", "limit": 1, "videos": [], "overrides": [], "dryRun": true }
```

It ships as a dry run of one video. To roll out, change it in a commit and run the apply workflow:

1. `dryRun: false`, `limit: 1`, `videos: ["<slug>"]`: the canary. Look at the video in Studio.
2. `limit: 10`, then `limit: 170` once a day until the plan has no `CHANGE` left.

The commit is the record of who allowed what. `overrides` takes slugs or YouTube IDs of `DRIFT` videos you want overwritten.

## Quota

YouTube gives 10,000 units a day, resetting at midnight Pacific. A `videos.update` costs 50 and a `videos.list` 1. The Worker counts units per Pacific day in D1 and stops at 9,000, leaving 1,000 for the analytics sync. So a day writes at most about 170 videos: the first push of ~330 videos takes 2 days for descriptions and titles. Thumbnails will add another 50 per video.

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
| `GET /status` | none | Latest plan's counts and time, last write result, quota used today. No titles or descriptions. |
| `POST /plan` | bearer | Read-only plan. |
| `GET /plans/<id\|latest>/report` | bearer | Markdown diff report. |
| `POST /apply` | bearer | `{ planId, limit, videos?, overrides?, dryRun? }`. |
| `POST /rollback` | bearer | `{ planId \| youtubeId, limit }`. |

`.github/workflows/youtube-sync-monitor.yml` reads `/status` daily and opens an issue if the plan stopped running, or found drift or errors.

## Verify locally

```sh
cuenv task check
cuenv task test
```

`test` builds the Worker and runs unit tests, D1 tests of plan, apply, drift, stale refusal, quota and rollback under Miniflare, and an end-to-end test through the built Worker with Google, the Academy API and the collector mocked. The service is excluded from the root Bun workspaces and has its own npm lockfile.
