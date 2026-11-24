#!/usr/bin/env bash
# Read-only: shows how `likes` is stored for the youtube.daily days that the
# MCP's youtube_daily returned with likes = null.
set -euo pipefail
query() {
	echo "== $1"
	curl -fsS "https://api.sql.cloudflarestorage.com/api/v1/accounts/$CLOUDFLARE_ACCOUNT_ID/basin-sql/query/rawkode-analytics" \
		-H "Authorization: Bearer $BASIN_SQL_TOKEN" -H "Content-Type: application/json" \
		--data "$(jq -n --arg query "$2" '{query: $query}')" | jq -c '.result.rows // .rows // .'
}
days="'2026-10-26','2026-10-27','2026-10-28','2026-11-03','2026-11-06','2026-11-07','2026-11-19','2026-11-20'"
query "stored rows for the affected days (latest fetches)" \
	"SELECT json_get_str(value, 'data', 'day') AS day, json_get_str(value, 'data', 'fetchedAt') AS fetched, json_get_int(value, 'data', 'likes') AS likes_int, json_get_str(value, 'data', 'likes') AS likes_str, json_get_int(value, 'data', 'views') AS views FROM analytics.events_archive WHERE event_source = 'rawkode-academy-youtube' AND event_type = 'youtube.daily' AND json_get_str(value, 'data', 'day') IN ($days) ORDER BY day, fetched DESC LIMIT 60"
query "raw value for one affected day" \
	"SELECT value FROM analytics.events_archive WHERE event_source = 'rawkode-academy-youtube' AND event_type = 'youtube.daily' AND json_get_str(value, 'data', 'day') = '2026-11-03' LIMIT 2"
query "rows with null likes (int) in the last 60 days, by fetch" \
	"SELECT json_get_str(value, 'data', 'fetchedAt') AS fetched, COUNT(*) AS rows, SUM(CASE WHEN json_get_int(value, 'data', 'likes') IS NULL THEN 1 ELSE 0 END) AS null_likes FROM analytics.events_archive WHERE event_source = 'rawkode-academy-youtube' AND event_type = 'youtube.daily' AND json_get_str(value, 'data', 'day') >= '2026-09-25' GROUP BY 1 ORDER BY 1 DESC LIMIT 20"
