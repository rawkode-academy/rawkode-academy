package cuenv

import (
	"list"

	"github.com/cuenv/cuenv/schema"
)

schema.#Project

name: "rawkode-academy-platform-youtube-control"

// Every task runs in a Nix shell with Python (and google-auth-oauthlib),
// Node 24, curl and jq from nixpkgs, so nothing depends on system or
// uv-downloaded toolchains (which don't run on NixOS).
let _nixShell = [
	"shell",
	"--impure",
	"--expr",
	"with (builtins.getFlake \"nixpkgs\").legacyPackages.${builtins.currentSystem}; buildEnv { name = \"youtube-analytics-tools\"; paths = [ (python3.withPackages (p: [ p.google-auth-oauthlib ])) nodejs_24 curl jq ]; }",
	"-c",
]
let _npm = "npm ci --workspaces=false --no-audit --no-fund >/dev/null && "
let _sources = ["src/**", "package.json", "package-lock.json", "wrangler.jsonc"]

tasks: [string]: hermetic: false

tasks: {
	check: schema.#Task & {
		command: "nix"
		args: list.Concat([_nixShell, ["sh", "-c", _npm + "npm run check --workspaces=false"]])
		inputs: list.Concat([_sources, ["test/**", "tsconfig.json", "secrets.d.ts"]])
	}
	test: schema.#Task & {
		command: "nix"
		args: list.Concat([_nixShell, ["sh", "-c", _npm + "npm test --workspaces=false"]])
		inputs: list.Concat([_sources, ["test/**"]])
	}
	deploy: schema.#Task & {
		command: "nix"
		args: list.Concat([_nixShell, ["sh", "-c", _npm + "npx --no-install wrangler deploy"]])
		inputs: _sources
	}
	// Deploys the Worker, authorizes the channel in the browser, stores the
	// Worker secrets and loads history. See README.md.
	connect: schema.#Task & {
		command: "nix"
		args: list.Concat([_nixShell, ["bash", "scripts/connect.sh"]])
		inputs: list.Concat([_sources, ["scripts/**"]])
	}
}
