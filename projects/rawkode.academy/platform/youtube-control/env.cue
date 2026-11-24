package cuenv

import (
	"list"

	"github.com/cuenv/cuenv/schema"
)

schema.#Project

name: "rawkode-academy-platform-youtube-control"

let _t = tasks

// The deploy reads the Google credential from Infisical in CI.
_ciInfisicalOidc: true

let _infrastructure = [{allowInfrastructure: ["plan", "apply", "import", "destroy"]}]

// Where `cuenv task consent` writes the Google OAuth client and refresh token.
// The github-actions identity (deploys on main) can already read this folder.
_youtubeSecret: _infisicalSecret & {secretPath: "/projects/basin"}

env: {
	// cuenv withholds Infisical credentials from providers unless the project
	// passes them explicitly. In CI the Infisical OIDC contributor sets them.
	INFISICAL_AUTH_JWT: {
		value: schema.#ExecSecret & {command: "printenv", args: ["INFISICAL_AUTH_JWT"]}
		policies: _infrastructure
	}
	INFISICAL_MACHINE_IDENTITY_ID: {
		value: schema.#ExecSecret & {command: "printenv", args: ["INFISICAL_MACHINE_IDENTITY_ID"]}
		policies: _infrastructure
	}
}

// Every task runs in a Nix shell with Python (and google-auth-oauthlib),
// Node 24, curl, jq and gh from nixpkgs, so nothing depends on system or
// uv-downloaded toolchains (which don't run on NixOS).
let _nixShell = [
	"shell",
	"--impure",
	"--expr",
	"with (builtins.getFlake \"nixpkgs\").legacyPackages.${builtins.currentSystem}; buildEnv { name = \"youtube-analytics-tools\"; paths = [ (python3.withPackages (p: [ p.google-auth-oauthlib ])) nodejs_24 curl jq gh ]; }",
	"-c",
]
let _npm = "npm ci --workspaces=false --no-audit --no-fund >/dev/null && "
let _sources = ["src/**", "package.json", "package-lock.json", "wrangler.jsonc", "secrets.env"]

ci: pipelines: default: {
	environment: "production"
	when: {
		branch: ["main"]
		defaultBranch: true
		manual:        true
	}
	tasks: [_t.deploy]
}

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

	// CI on main: tests, then deploys the Worker with its secrets from
	// Infisical. Fails if `cuenv task consent` hasn't stored them yet.
	deploy: schema.#Task & {
		command: "nix"
		args: list.Concat([_nixShell, ["sh", "-c", _npm + "npm test --workspaces=false && npx --no-install wrangler deploy --secrets-file secrets.env"]])
		inputs: list.Concat([_sources, ["env.cue", "test/**"]])
		labels: ["infisical"]
		env: {
			YOUTUBE_CLIENT_ID: _youtubeSecret & {secretName: "YOUTUBE_CLIENT_ID"}
			YOUTUBE_CLIENT_SECRET: _youtubeSecret & {secretName: "YOUTUBE_CLIENT_SECRET"}
			YOUTUBE_REFRESH_TOKEN: _youtubeSecret & {secretName: "YOUTUBE_REFRESH_TOKEN"}
		}
	}

	// Run by hand, once, and again whenever the sync alert says the grant was
	// revoked: Google consent in the browser, credential to Infisical, then the
	// deploy workflow. Logs in to Infisical as the bootstrap machine identity.
	consent: schema.#Task & {
		command: "nix"
		args: list.Concat([_nixShell, ["python", "-I", "scripts/consent.py"]])
		inputs: ["scripts/consent.py"]
		env: {
			INFISICAL_UNIVERSAL_AUTH_CLIENT_ID: schema.#OnePasswordRef & {ref: "op://Employee/Infisical/machine-identity/client-id"}
			INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET: schema.#OnePasswordRef & {ref: "op://Employee/Infisical/machine-identity/client-secret"}
		}
	}

	// Starts another history load; see scripts/backfill.sh.
	backfill: schema.#Task & {
		command: "nix"
		args: list.Concat([_nixShell, ["sh", "-c", _npm + "bash scripts/backfill.sh"]])
		inputs: list.Concat([_sources, ["scripts/backfill.sh"]])
	}
}
