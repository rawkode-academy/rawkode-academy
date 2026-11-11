#!/usr/bin/env bash
# Table maintenance for the analytics lake: compaction and snapshot expiry.
# infrastructure.cue creates everything else; the Cloudflare provider has no
# resource for these settings yet.
#
# Runs on main whenever this script or infrastructure.cue changes, so a rotated
# catalog token is stored again. Both calls replace what is there, so re-runs
# are safe.
#
# Requires: CLOUDFLARE_ACCOUNT_ID, BASIN_CATALOG_TOKEN (written to Infisical by
# infrastructure.cue). The catalog token is also the API token: it holds
# Workers R2 Data Catalog Write, which is all these calls need.
set -euo pipefail

BUCKET="rawkode-analytics"

: "${CLOUDFLARE_ACCOUNT_ID:?}"
: "${BASIN_CATALOG_TOKEN:?}"

catalog() {
	local path=$1 body=$2
	curl --fail-with-body --silent --show-error \
		--request POST \
		--header "Authorization: Bearer ${BASIN_CATALOG_TOKEN}" \
		--header "Content-Type: application/json" \
		--data @- \
		"https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2-catalog/${BUCKET}/${path}" \
		<<<"$body" >/dev/null
	echo "Updated ${path}"
}

# Compaction runs as this credential; without it, it never starts.
# Cloudflare tokens are URL-safe base64, so they need no JSON escaping.
catalog credential "{\"token\": \"${BASIN_CATALOG_TOKEN}\"}"

catalog maintenance-configs '{
	"compaction": {"state": "enabled", "target_size_mb": "128"},
	"snapshot_expiration": {"state": "enabled", "max_snapshot_age": "7d", "min_snapshots_to_keep": 10}
}'
