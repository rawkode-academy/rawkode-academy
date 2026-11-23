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

## Deploy

1. In a Google Cloud project, enable **YouTube Data API v3** and **YouTube Analytics API**. Publish the OAuth consent screen (in **Testing**, refresh tokens expire after seven days), and create a **Desktop app** OAuth client.
2. As the channel owner, on a machine with a browser:

   ```sh
   uv run scripts/authorize.py \
     --client-secrets /private/google-desktop-client.json \
     --channel UCrber_mFvp_FEF7D9u8PDEA \
     --output /private/youtube.credentials.json
   ```

   It requests read-only YouTube and YouTube Analytics access, checks that the grant is for exactly that channel, and saves the credential with mode `0600`.
3. Deploy and set the secrets:

   ```sh
   npm ci --workspaces=false
   npm run deploy
   npx wrangler secret put YOUTUBE_CREDENTIALS_JSON < /private/youtube.credentials.json
   openssl rand -hex 32 | npx wrangler secret put API_TOKEN
   ```

   `API_TOKEN` protects the endpoints below. Keep a copy in your secret manager.
4. Load history once, repeating until `next` is `null`:

   ```sh
   since=2019-01-01
   while [ "$since" != "null" ]; do
     since=$(curl -fsS -X POST "$ORIGIN/v1/analytics/backfill" -H "authorization: Bearer $API_TOKEN" \
       -H 'content-type: application/json' -d "{\"since\":\"$since\"}" | jq -r .next)
   done
   ```

   Each call collects one 92-day window of `daily` and `daily_traffic`, which keeps it inside Workers' subrequest limit (one collector call per row).

## Endpoints

All but `/health` need `authorization: Bearer $API_TOKEN` and a JSON body.

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Process health only. |
| `POST /v1/analytics/collect` | Fetch one report, e.g. `{ "report": "daily", "startDate": "2026-10-01", "endDate": "2026-10-31" }` (1–92 days; `videoId` for `retention`/`concurrent_viewers`), send its rows, and return it with `lake: { sent, failed }`. |
| `POST /v1/analytics/sync` | Run the daily collection now. |
| `POST /v1/analytics/backfill` | `{ "since": "YYYY-MM-DD" }`: one window of history; returns `next`. |

`sync` and `backfill` return 502 when any report or row failed; the body lists each report's outcome.

## Verify locally

Requires Node 24 and npm; this service is excluded from the root Bun workspaces and has its own lockfile.

```sh
npm ci --workspaces=false
npm run check --workspaces=false
npm test --workspaces=false
```

`npm test` builds the Worker and runs unit tests plus a Miniflare test with Google and the collector mocked.

## Revoking access

Revoke the app's access in the Google account, then delete or replace the `YOUTUBE_CREDENTIALS_JSON` secret.
