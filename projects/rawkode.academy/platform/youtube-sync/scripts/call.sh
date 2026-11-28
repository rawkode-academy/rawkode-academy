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
    # The full report goes to the job summary. The log gets the title changes and the start
    # of the report: a long stream into the runner's log closes the pipe (exit 141).
    printf '%s\n' "$report" >>"$summary"
    echo "## Title changes (slug: before -> after)"
    awk '/^### /{slug=$2} /^\*\*title\*\* before:/{m="b";next} m=="b"&&/^after:/{m="a";next} m&&/^\*\*/{m=""} m&&/^    ./{sub(/^    /,""); if(m=="b")b=$0; else {print slug": "b"  ->  "$0; m=""}}' <<<"$report"
    echo "## Start of the report (the rest is in the job summary)"
    printf '%s\n' "${report:0:20000}"
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
    body=$(jq -c '{planId, limit, videos, dryRun, priority} | with_entries(select(.value != null))' apply.json)
    echo "Applying: $body"
    result=$(request -X POST "$base/apply" -d "$body")
    echo "$result" | jq . | tee -a "$summary"
    ;;
  *) echo "usage: call.sh plan|apply" >&2; exit 2 ;;
esac
