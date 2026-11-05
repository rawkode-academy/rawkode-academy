#!/usr/bin/env bash
# Table maintenance for the analytics lake: compaction and snapshot expiry.
# infrastructure.cue creates everything else; the Cloudflare provider has no
# resource for these settings yet.
#
# Requires: CLOUDFLARE_API_TOKEN, BASIN_CATALOG_TOKEN (written to Infisical by
# infrastructure.cue).
set -euo pipefail

BUCKET="rawkode-analytics"

: "${CLOUDFLARE_API_TOKEN:?}"
: "${BASIN_CATALOG_TOKEN:?}"

wrangler() { bun x wrangler "$@"; }

# Re-runs are expected: tolerate "already enabled", fail on anything else.
idempotent() {
	local output
	if output=$("$@" 2>&1); then
		echo "$output"
	elif grep -qi "already" <<<"$output"; then
		echo "$output"
	else
		echo "$output" >&2
		return 1
	fi
}

idempotent wrangler basin catalog compaction enable "$BUCKET" --target-size 128 --token "$BASIN_CATALOG_TOKEN"
idempotent wrangler basin catalog snapshot-expiration enable "$BUCKET" --token "$BASIN_CATALOG_TOKEN" --older-than-days 7 --retain-last 10
