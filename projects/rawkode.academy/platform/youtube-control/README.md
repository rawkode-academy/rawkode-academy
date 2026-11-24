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

Dates are YouTube's `America/Los_Angeles` reporting days. A cron at 08:17 UTC collects the last 28 days of `daily`, `daily_traffic`, `top_videos`, `traffic` and `summary`. YouTube revises recent days, so the same day is sent again on later runs: readers keep the latest `fetchedAt` per day (and per traffic source). [infra/lake-queries.sql](infra/lake-queries.sql) has the queries for views and watch time per day and views per traffic source per day. Re-sending also repairs any day a failed run missed.

## Go live

1. In Google Cloud, create a project with **YouTube Data API v3** and **YouTube Analytics API** enabled, an OAuth consent screen **published to Production** (in Testing, refresh tokens die after seven days), and a **Desktop app** OAuth client. Download the client JSON.
2. From this directory: `cuenv task connect`.

`connect` runs [scripts/connect.sh](scripts/connect.sh) in a Nix shell (Python with google-auth-oauthlib, Node 24, curl and jq from nixpkgs). It asks for the client JSON (default: the single `~/Downloads/client_secret_*.json`), signs Wrangler in as you if needed, deploys the Worker, opens Google consent, and stores two Worker secrets:

| Secret | Value |
| --- | --- |
| `YOUTUBE_CREDENTIALS_JSON` | The offline credential from [scripts/authorize.py](scripts/authorize.py): read-only YouTube and YouTube Analytics scopes, checked to be exactly this channel. It goes straight from the script to `wrangler secret put` and is never written to disk. |
| `API_TOKEN` | A random token generated for the run. |

It then runs a sync (the last 28 days) and loads history from `YOUTUBE_ANALYTICS_SINCE` (default 2015-01-01), one 30-day window per request. Rerun it to reauthorize or rotate the token; set `YOUTUBE_ANALYTICS_SINCE` to resume an interrupted backfill. After that the cron keeps the lake current. Deploy code changes with `cuenv task deploy`.

## Endpoints

All but `/health` need `authorization: Bearer $API_TOKEN` and a JSON body. `connect` doesn't keep the token; rerun it for a new one when you need to call these yourself.

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Process health only. |
| `POST /v1/analytics/collect` | Fetch one report, e.g. `{ "report": "daily", "startDate": "2026-10-01", "endDate": "2026-10-31" }` (1–92 days; `videoId` for `retention`/`concurrent_viewers`), send its rows, and return it with `lake: { sent, failed }`. |
| `POST /v1/analytics/sync` | Run the daily collection now. |
| `POST /v1/analytics/backfill` | `{ "since": "YYYY-MM-DD" }`: one 30-day window of history; returns `next`. |

`sync` and `backfill` return 502 when any report or row failed; the body lists each report's outcome.

## Verify locally

```sh
cuenv task check
cuenv task test
```

`test` builds the Worker and runs unit tests plus a Miniflare test with Google and the collector mocked. The service is excluded from the root Bun workspaces and has its own npm lockfile.

## Revoking access

Revoke the app's access in the Google account, then rerun `cuenv task connect` or delete the `YOUTUBE_CREDENTIALS_JSON` secret with `wrangler secret delete`.
