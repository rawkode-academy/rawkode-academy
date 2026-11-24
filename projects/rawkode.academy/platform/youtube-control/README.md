# YouTube analytics

A Cloudflare Worker that reads the Rawkode Academy channel's YouTube Analytics reports and sends every row to the Academy analytics lake.

Rows go, one CloudEvent each, to `rawkode-tools-observability-collector` through the `ANALYTICS` service binding. The collector persists them before acknowledging and delivers them to `analytics.events_archive` in the `rawkode-analytics` bucket, the same Basin lake as website and short-link analytics. Events use source `rawkode-academy-youtube` and type `youtube.<report>`; the row's dimensions and metrics are in `data`, next to `channelId`, `startDate`, `endDate` and `fetchedAt`.

| Report | Dimensions | Metrics |
| --- | --- | --- |
| `daily` | `day` | views, engaged views, watch minutes, average view duration/percentage, likes, comments, shares, subscribers gained/lost |
| `daily_traffic` | `day`, `insightTrafficSourceType` | views, watch minutes |
| `top_videos` | `video` (top 50 by views) | as `daily` |
| `traffic` | `insightTrafficSourceType` | views, watch minutes |
| `summary` | none | as `daily` |
| `retention`, `concurrent_viewers` | per video, on request only | |

Dates are YouTube's `America/Los_Angeles` reporting days. YouTube revises recent days, so the same day is sent again on later runs: readers keep the latest `fetchedAt` per day (and per traffic source). [infra/lake-queries.sql](infra/lake-queries.sql) has the queries for views and watch time per day and views per traffic source per day.

## How it runs

- **Daily sync.** A cron at 08:17 UTC starts the `youtube-analytics-sync` Workflow (instance `sync-<UTC date>`), which collects the last 28 days of `daily`, `daily_traffic`, `top_videos`, `traffic` and `summary`, one retried step per report. Re-sending recent days also repairs a day a failed run missed.
- **History.** The first cron after deploy also starts `youtube-analytics-backfill` once (instance `backfill-initial`), from `YOUTUBE_HISTORY_SINCE` (2015-01-01) in 30-day steps of `daily` and `daily_traffic`. `cuenv task backfill -e production` starts another; it is safe to repeat.
- **Credentials.** `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` and `YOUTUBE_REFRESH_TOKEN` live in Infisical at `/projects/basin` (production). `cuenv task consent` writes them; nothing else does. The YouTube Analytics API doesn't accept service accounts, so a channel owner's refresh token is unavoidable.
- **Deploy.** CI on `main` (`rawkode-academy-platform-youtube-control-default`) runs the tests and `wrangler deploy --secrets-file secrets.env`, with the three secrets read from Infisical as the `github-actions` identity and the Workers token from the root `env.cue`. Nothing is deployed from a laptop.
- **Alerts.** `.github/workflows/youtube-analytics-monitor.yml` reads `GET /status` at 10:47 UTC. If today's sync didn't complete (or the initial backfill failed), it opens an issue titled "YouTube analytics sync is failing", or comments on the open one, and closes it once a sync completes. A revoked or expired grant (`invalid_grant`) stops the sync without retries and the issue says to run `cuenv task consent`.

## Going live

1. In Google Cloud, create a project with **YouTube Data API v3** and **YouTube Analytics API** enabled, an OAuth consent screen that is **Internal** (Workspace) or **published to Production** (in Testing, refresh tokens die after seven days), and a **Desktop app** OAuth client. Store its client ID and secret in 1Password at `op://Employee/565nub77bcoxqd5a77kbdets3q/youtube-control/client-id` and `.../client-secret`.
2. `cuenv task consent` in this directory. It reads the OAuth client from 1Password, opens Google consent (pick the Rawkode Academy channel), checks the grant is for exactly that channel, writes the client ID, client secret and refresh token to Infisical as the bootstrap machine identity (also from 1Password), and starts the deploy workflow if it's on `main`.
3. Merge. CI deploys; the next 08:17 UTC cron runs the first sync and starts the backfill.

When the alert says the grant was revoked, repeat step 2.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Process health only. |
| `GET /status` | Today's (or yesterday's) sync instance and the initial backfill: `status` and `error` only. |

To run today's sync (and the initial backfill, if it hasn't started) now and see what reached the lake, run the `rawkode-academy-platform-youtube-control-verify` workflow from Actions.

## Verify locally

```sh
cuenv task check
cuenv task test
```

`test` builds the Worker and runs unit tests plus Miniflare tests of both Workflows with Google and the collector mocked, including a revoked grant. The service is excluded from the root Bun workspaces and has its own npm lockfile.

## Revoking access

Revoke the app in the Google account's security settings and delete the three secrets from Infisical; the next sync fails and the alert opens.
