#!/usr/bin/env bash
# Starts a history load through the youtube-analytics-backfill Workflow. The
# first one runs on its own after the first deploy; use this to load again,
# e.g. `SINCE=2024-01-01 cuenv task backfill -e production`, or per-video
# history with SCOPE=videos. Safe to repeat:
# readers keep the latest observation per day.
set -euo pipefail
since="${SINCE:-2015-01-01}"
scope="${SCOPE:-channel}"
[[ "$since" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "SINCE must be YYYY-MM-DD" >&2; exit 1; }
[[ "$scope" =~ ^(channel|videos)$ ]] || { echo "SCOPE must be channel or videos" >&2; exit 1; }
npx --no-install wrangler workflows trigger youtube-analytics-backfill "{\"since\":\"$since\",\"scope\":\"$scope\"}" --id "backfill-$scope-$since-$(date -u +%Y%m%dT%H%M%S)"
echo "Started. Follow it with: npx wrangler workflows instances list youtube-analytics-backfill" >&2
