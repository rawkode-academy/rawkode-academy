#!/usr/bin/env bash
# Build and deploy the Waddle web client (waddle-social/waddle, chat/) as
# rawkode.chat. The client is built from upstream inside Waddle's own Nix dev
# shell (it compiles the XMPP client to WebAssembly) and deployed with the
# wrangler config rewritten by configure-wrangler.ts.
#
# The checkout lives outside this repository so the root Bun workspace
# (projects/**) never picks up Waddle's packages.
#
# Usage: waddle.sh build|deploy
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ref="${WADDLE_REF:-main}"
checkout="${WADDLE_CHECKOUT:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/rawkode-chat-waddle}"

in_waddle_shell() {
	(cd "$checkout" && nix develop --accept-flake-config . -c bash -euo pipefail -c "$1")
}

case "${1:-}" in
build)
	rm -rf "$checkout"
	git clone --quiet --depth 1 --branch "$ref" https://github.com/waddle-social/waddle.git "$checkout"
	echo "waddle ${ref} @ $(git -C "$checkout" rev-parse --short HEAD)"
	bun "$here/configure-wrangler.ts" "$checkout/chat/wrangler.jsonc"
	in_waddle_shell 'bun install --frozen-lockfile && cd chat && bun run generate-types && bun run build && bun run sourcemaps:strip'
	;;
deploy)
	test -d "$checkout/chat/dist" || { echo "no build at $checkout; run: waddle.sh build" >&2; exit 1; }
	in_waddle_shell 'cd chat && bun x wrangler deploy'
	;;
*)
	echo "usage: $0 build|deploy" >&2
	exit 1
	;;
esac
