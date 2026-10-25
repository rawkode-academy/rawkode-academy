#!/usr/bin/env bash
# One-time provisioning for the analytics lake: R2 bucket + Basin Catalog,
# table maintenance, stream, Iceberg sink, and pipeline.
#
# Streams, sinks and pipeline SQL cannot be modified after creation. Each step
# skips if the resource already exists; to change one, delete it and re-run.
#
# Requires: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, BASIN_CATALOG_TOKEN
# (an R2 Admin Read & Write token, used by the sink and table maintenance).
set -euo pipefail

cd "$(dirname "$0")"

BUCKET="rawkode-analytics"
NAMESPACE="analytics"
TABLE="events"
STREAM="analytics_events"
SINK="analytics_events_iceberg"
PIPELINE="analytics_events_pipeline"

: "${CLOUDFLARE_API_TOKEN:?}"
: "${CLOUDFLARE_ACCOUNT_ID:?}"
: "${BASIN_CATALOG_TOKEN:?}"

wrangler() { bun x wrangler "$@"; }

if ! wrangler r2 bucket list | grep -q "name:\s*${BUCKET}$"; then
	wrangler r2 bucket create "$BUCKET"
fi

wrangler basin catalog enable "$BUCKET" || true
wrangler basin catalog compaction enable "$BUCKET" --target-size 128 --token "$BASIN_CATALOG_TOKEN" || true
wrangler basin catalog snapshot-expiration enable "$BUCKET" --token "$BASIN_CATALOG_TOKEN" --older-than-days 7 --retain-last 10 || true

if ! wrangler basin pipelines streams list | grep -q "$STREAM"; then
	wrangler basin pipelines streams create "$STREAM" --schema-file schema.json
fi

if ! wrangler basin pipelines sinks list | grep -q "$SINK"; then
	wrangler basin pipelines sinks create "$SINK" \
		--type basin-catalog \
		--bucket "$BUCKET" \
		--namespace "$NAMESPACE" \
		--table "$TABLE" \
		--catalog-token "$BASIN_CATALOG_TOKEN" \
		--roll-interval 300 \
		--compression zstd
fi

if ! wrangler basin pipelines list | grep -q "$PIPELINE"; then
	wrangler basin pipelines create "$PIPELINE" --sql-file pipeline.sql
fi

echo
echo "Stream ID (put this in ../wrangler.jsonc under pipelines[].stream):"
wrangler basin pipelines streams list | grep -A3 "$STREAM"
