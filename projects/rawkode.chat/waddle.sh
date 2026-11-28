#!/usr/bin/env bash
# Build and deploy the Waddle web client (waddle-social/waddle, chat/) as
# rawkode.chat. The client is built from upstream inside Waddle's own Nix dev
# shell (it compiles the XMPP client to WebAssembly) and deployed with the
# wrangler config rewritten by configure-wrangler.ts.
#
# The checkout lives outside this repository so the root Bun workspace
# (projects/**) never picks up Waddle's packages.
#
# Usage:
#   waddle.sh checkout             clone Waddle; prints only the checkout path
#   WADDLE_CHECKOUT=<path> waddle.sh build|deploy
#
# In cuenv, the checkout task's stdout is passed to build and deploy as
# WADDLE_CHECKOUT (each task gets its own TMPDIR, so the path is explicit).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ref="${WADDLE_REF:-main}"

in_waddle_shell() {
	(cd "$WADDLE_CHECKOUT" && nix develop --accept-flake-config . -c bash -euo pipefail -c "$1")
}

require_checkout() {
	if [ -z "${WADDLE_CHECKOUT:-}" ] || [ ! -d "$WADDLE_CHECKOUT/chat" ]; then
		echo "WADDLE_CHECKOUT must point at a Waddle checkout; run: waddle.sh checkout" >&2
		exit 1
	fi
}

case "${1:-}" in
checkout)
	# Outside TMPDIR: cuenv's per-task TMPDIR is not shared between tasks.
	checkout="$(mktemp -d "${RUNNER_TEMP:-/tmp}/rawkode-chat-waddle.XXXXXX")"
	git clone --quiet --depth 1 --branch "$ref" https://github.com/waddle-social/waddle.git "$checkout" >&2
	echo "waddle ${ref} @ $(git -C "$checkout" rev-parse --short HEAD)" >&2
	printf '%s' "$checkout"
	;;
build)
	require_checkout
	bun "$here/configure-wrangler.ts" "$WADDLE_CHECKOUT/chat/wrangler.jsonc" >&2
	in_waddle_shell 'bun install --frozen-lockfile && cd chat && bun run generate-types && bun run build && bun run sourcemaps:strip'
	;;
deploy)
	require_checkout
	test -d "$WADDLE_CHECKOUT/chat/dist" || { echo "no build in $WADDLE_CHECKOUT; run: waddle.sh build" >&2; exit 1; }
	in_waddle_shell 'cd chat && bun x wrangler deploy'
	;;
*)
	echo "usage: $0 checkout|build|deploy" >&2
	exit 1
	;;
esac
