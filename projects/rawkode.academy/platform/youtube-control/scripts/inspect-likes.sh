#!/usr/bin/env bash
# Read-only: tries ways of reading a negative `likes` (YouTube reports net
# likes, so a day with more removed than added is negative) from
# analytics.events_archive. json_get_int returns NULL for a negative integer.
set -uo pipefail
query() {
	echo "== $1"
	curl -sS "https://api.sql.cloudflarestorage.com/api/v1/accounts/$CLOUDFLARE_ACCOUNT_ID/basin-sql/query/rawkode-analytics" \
		-H "Authorization: Bearer $BASIN_SQL_TOKEN" -H "Content-Type: application/json" \
		--data "$(jq -n --arg query "$2" '{query: $query}')" | jq -c '.result.rows // .errors // .'
}
base="FROM analytics.events_archive WHERE event_source = 'rawkode-academy-youtube' AND event_type = 'youtube.daily' AND json_get_str(value, 'data', 'day') IN ('2026-11-03','2026-11-20') AND json_get_str(value, 'data', 'fetchedAt') = '2026-11-24T16:19:59.024Z'"
for expr in \
	"json_get_int(value, 'data', 'likes')" \
	"json_get_float(value, 'data', 'likes')" \
	"json_as_text(value, 'data', 'likes')" \
	"CAST(json_as_text(value, 'data', 'likes') AS BIGINT)" \
	"CAST(json_get(value, 'data', 'likes') AS VARCHAR)" \
	"CAST(json_get_float(value, 'data', 'likes') AS BIGINT)" \
	"json_get_int(value, 'data', 'comments')" \
	"json_get_int(value, 'data', 'subscribersLost')"; do
	query "$expr" "SELECT json_get_str(value, 'data', 'day') AS day, $expr AS v $base ORDER BY day"
done
