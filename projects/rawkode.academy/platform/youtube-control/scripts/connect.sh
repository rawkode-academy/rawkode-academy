#!/usr/bin/env bash
# Connects the Academy YouTube channel to the analytics lake, end to end:
# deploys the Worker, authorizes the channel in the browser, stores both Worker
# secrets, and loads the channel's history. Run it through `cuenv task connect`,
# which supplies Python, Node and curl from nixpkgs. Safe to rerun: it replaces
# the credential and API token.
set -euo pipefail
cd "$(dirname "$0")/.."

channel="UCrber_mFvp_FEF7D9u8PDEA"
origin="${YOUTUBE_ANALYTICS_ORIGIN:-https://rawkode-academy-youtube-analytics.rawkodeacademy.workers.dev}"
since="${YOUTUBE_ANALYTICS_SINCE:-2015-01-01}"

# Wrangler acts as you (`wrangler login`), not with a token from the environment.
unset CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID="0aeb879de8e3cdde5fb3d413025222ce"
wrangler() { npx --no-install wrangler "$@"; }

client="${GOOGLE_OAUTH_CLIENT_JSON:-}"
if [ -z "$client" ]; then
	shopt -s nullglob
	candidates=("$HOME"/Downloads/client_secret_*.apps.googleusercontent.com.json)
	if [ "${#candidates[@]}" -eq 1 ]; then client="${candidates[0]}"; fi
	read -r -e -p "Google Desktop OAuth client JSON [${client:-path}]: " answer </dev/tty || true
	client="${answer:-$client}"
fi
[ -f "$client" ] || { echo "No such file: $client" >&2; exit 1; }

npm ci --workspaces=false --no-audit --no-fund >/dev/null
wrangler whoami >/dev/null 2>&1 || wrangler login

echo "Deploying the Worker…" >&2
wrangler deploy

echo "Authorizing the channel: pick the Rawkode Academy channel in the browser." >&2
credentials="$(python -I scripts/authorize.py --client-secrets "$client" --channel "$channel" --output -)"
printf '%s' "$credentials" | wrangler secret put YOUTUBE_CREDENTIALS_JSON
unset credentials

# A fresh token for this run's backfill. Nothing else needs it; rerun this task
# to get a new one when you want to call the API yourself.
token="$(od -An -tx1 -N32 /dev/urandom | tr -d ' \n')"
printf '%s' "$token" | wrangler secret put API_TOKEN

echo "Waiting for the new secrets to reach the Worker…" >&2
for _ in $(seq 1 30); do
	status=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$origin/v1/analytics/sync" -H "authorization: Bearer $token" -H 'content-type: application/json' -d '{}' || true)
	[ "$status" = "200" ] && break
	sleep 5
done
[ "$status" = "200" ] || { echo "The first sync failed (HTTP $status). Check the Worker's logs, then rerun." >&2; exit 1; }
echo "Last 28 days are in the lake. Loading history from $since…" >&2

while [ "$since" != "null" ]; do
	response=$(curl -sS -X POST "$origin/v1/analytics/backfill" -H "authorization: Bearer $token" -H 'content-type: application/json' -d "{\"since\":\"$since\"}")
	if [ "$(printf '%s' "$response" | jq -r .success)" != "true" ]; then
		echo "Backfill from $since failed:" >&2
		printf '%s' "$response" | jq '.outcomes // .' >&2
		echo "Rerun with YOUTUBE_ANALYTICS_SINCE=$since to resume." >&2
		exit 1
	fi
	echo "  $since done" >&2
	since=$(printf '%s' "$response" | jq -r .next)
done
echo "Done. YouTube metrics are in analytics.events_archive (source rawkode-academy-youtube)." >&2
