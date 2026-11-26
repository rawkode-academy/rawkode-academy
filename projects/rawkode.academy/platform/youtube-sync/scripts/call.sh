#!/usr/bin/env bash
# Calls the sync Worker as CI: `call.sh plan` or `call.sh apply`. The bearer
# token comes from Infisical through cuenv (SYNC_ADMIN_TOKEN). Output goes to
# the job summary as well as the log.
set -euo pipefail
base="${SYNC_URL:-https://rawkode-academy-youtube-sync.rawkodeacademy.workers.dev}"
summary="${GITHUB_STEP_SUMMARY:-/dev/null}"
auth=(-H "authorization: Bearer ${SYNC_ADMIN_TOKEN:?SYNC_ADMIN_TOKEN is not set}")

request() { curl -fsS --max-time 300 "${auth[@]}" -H 'content-type: application/json' "$@"; }

case "${1:-}" in
  plan)
    result=$(request -X POST "$base/plan")
    echo "$result" | jq .
    id=$(jq -r .id <<<"$result")
    report=$(request "$base/plans/$id/report")
    echo "$report" | tee -a "$summary"
    # The full, untruncated change for one video (the first named in apply.json,
    # else the first in the plan), so it can be reviewed before an apply.
    slug=$(jq -r '.videos[0] // empty' apply.json)
    slug=${slug:-$(sed -n 's/^### \([^ ]*\) (https.*/\1/p' <<<"$report" | sed -n 1p)}
    if [ -n "$slug" ]; then
      { echo; echo "## Full change for $slug"; request "$base/plans/$id/videos/$slug" | jq -r '"Status: \(.status)\(if .reason then " (" + .reason + ")" else "" end)\n", (.changes[] | "### \(.field) before\n\n```\n\(.before)\n```\n\n### \(.field) after\n\n```\n\(.after)\n```\n"), (if .thumbnail then "### thumbnail\n\nsource: \(.thumbnail.url)\nchanged: \(.thumbnail.changed)" else empty end)'; } | tee -a "$summary"
    fi
    ;;
  apply)
    # apply.json is the approval: its commit says which plan size and videos
    # are allowed to be written. See README.
    body=$(jq -c '{planId, limit, videos, dryRun} | with_entries(select(.value != null))' apply.json)
    echo "Applying: $body"
    result=$(request -X POST "$base/apply" -d "$body")
    echo "$result" | jq . | tee -a "$summary"
    ;;
  *) echo "usage: call.sh plan|apply" >&2; exit 2 ;;
esac
