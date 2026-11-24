#!/usr/bin/env bash
# Runs today's sync now instead of waiting for the 08:17 UTC cron, starts the
# channel and per-video backfills if they haven't started, waits for the sync
# to finish and prints what reached the lake. The starts use the IDs the cron
# uses (sync-<UTC date>, backfill-initial, backfill-videos-2), so the cron won't
# run them again. Run it again later to see the backfills' progress.
# Run from CI as the manual `verify` pipeline.
set -euo pipefail

worker=https://rawkode-academy-youtube-analytics.rawkodeacademy.workers.dev
today=$(date -u +%F)
status() { curl -fsS "$worker/status"; }

if [ "$(status | jq -r '.sync.id // empty')" != "sync-$today" ]; then
	npx --no-install wrangler workflows trigger youtube-analytics-sync '{}' --id "sync-$today"
fi
if [ -z "$(status | jq -r '.backfill.id // empty')" ]; then
	npx --no-install wrangler workflows trigger youtube-analytics-backfill '{"since":"2015-01-01"}' --id backfill-initial
fi
if [ -z "$(status | jq -r '.videoBackfill.id // empty')" ]; then
	npx --no-install wrangler workflows trigger youtube-analytics-backfill '{"since":"2015-01-01","scope":"videos"}' --id backfill-videos-2
fi

for _ in $(seq 1 90); do
	sync=$(status | jq -r '.sync.status // "unknown"')
	case "$sync" in complete | errored | terminated) break ;; esac
	sleep 10
done
echo "Status: $(status)"
# Where the first per-video backfill (backfill-videos) stopped: step names and
# errors, no data. Best effort.
echo "First per-video backfill, as it stopped:"
npx --no-install wrangler workflows instances describe youtube-analytics-backfill backfill-videos 2>&1 | grep -iE "name|status|error|fail" | tail -25 || true

query() {
	curl -fsS "https://api.sql.cloudflarestorage.com/api/v1/accounts/$CLOUDFLARE_ACCOUNT_ID/basin-sql/query/rawkode-analytics" \
		-H "Authorization: Bearer $BASIN_SQL_TOKEN" -H "Content-Type: application/json" \
		--data "$(jq -n --arg query "$1" '{query: $query}')" | jq -c '.result.rows // .rows // .'
}
echo "Rows in analytics.events_archive by report:"
query "SELECT event_type, COUNT(*) AS rows, COUNT(DISTINCT json_get_str(value, 'data', 'video')) AS videos, MIN(json_get_str(value, 'data', 'day')) AS first_day, MAX(json_get_str(value, 'data', 'day')) AS last_day FROM analytics.events_archive WHERE event_source = 'rawkode-academy-youtube' GROUP BY event_type ORDER BY event_type"

[ "$sync" = complete ]
