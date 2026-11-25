package cuenv

import (
	"list"

	"github.com/cuenv/cuenv/schema"
	xNix "github.com/cuenv/cuenv/contrib/nix"
)

schema.#Project

name: "rawkode-academy-platform-youtube-control"

// Tasks run in this directory's flake.nix dev shell (Node, Python with
// google-auth-oauthlib, gh), pinned by flake.lock, so nothing depends on
// system or uv-downloaded toolchains (which don't run on NixOS).
runtime: schema.#NixRuntime
hooks: onEnter: nix: xNix.#NixFlake

let _t = tasks

// The deploy reads the Google credential from Infisical in CI.
_ciInfisicalOidc: true

let _infrastructure = [{allowInfrastructure: ["plan", "apply", "import", "destroy"]}]

// Where `cuenv task consent` writes the Google OAuth client and refresh token.
// The github-actions identity (deploys on main) can already read this folder.
_youtubeSecret: _infisicalSecret & {secretPath: "/projects/rawkode-academy/platform/youtube-control"}

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

let _npm = "npm ci --workspaces=false --no-audit --no-fund >/dev/null && "
let _sources = ["src/**", "package.json", "package-lock.json", "wrangler.jsonc", "secrets.env", "flake.nix", "flake.lock"]

ci: pipelines: default: {
	environment: "production"
	when: {
		branch: ["main"]
		defaultBranch: true
		manual:        true
	}
	tasks: [_t.deploy]
}

// Run by hand from Actions: starts today's sync and the initial backfill now
// (with the cron's instance IDs) and prints what reached the lake.
ci: pipelines: verify: {
	environment: "production"
	when: manual: true
	tasks: [_t.verify]
}

// Run by hand from Actions: read-only look at how `likes` is stored in the lake.
ci: pipelines: inspect: {
	environment: "production"
	when: manual: true
	tasks: [_t.inspect]
}

tasks: [string]: hermetic: false

tasks: {
	check: schema.#Task & {
		command: "sh"
		args: ["-c", _npm + "npm run check --workspaces=false"]
		inputs: list.Concat([_sources, ["test/**", "tsconfig.json", "secrets.d.ts"]])
	}
	test: schema.#Task & {
		command: "sh"
		args: ["-c", _npm + "npm test --workspaces=false"]
		inputs: list.Concat([_sources, ["test/**"]])
	}

	// CI on main: tests, then deploys the Worker with its secrets from
	// Infisical. Fails if `cuenv task consent` hasn't stored them yet.
	deploy: schema.#Task & {
		command: "sh"
		args: ["-c", _npm + "npm test --workspaces=false && npx --no-install wrangler deploy --secrets-file secrets.env"]
		inputs: list.Concat([_sources, ["env.cue", "test/**"]])
		labels: ["infisical"]
		env: {
			YOUTUBE_CLIENT_ID: _youtubeSecret & {secretName: "YOUTUBE_CLIENT_ID"}
			YOUTUBE_CLIENT_SECRET: _youtubeSecret & {secretName: "YOUTUBE_CLIENT_SECRET"}
			YOUTUBE_REFRESH_TOKEN: _youtubeSecret & {secretName: "YOUTUBE_REFRESH_TOKEN"}
		}
	}

	// Run by hand, once, and again whenever the sync alert says the grant was
	// revoked: Google consent in the browser with the OAuth client from 1Password, credential to Infisical, then the
	// deploy workflow. Logs in to Infisical as the bootstrap machine identity.
	consent: schema.#Task & {
		command: "python"
		args: ["-I", "scripts/consent.py"]
		inputs: ["scripts/consent.py"]
		env: {
			INFISICAL_UNIVERSAL_AUTH_CLIENT_ID: schema.#OnePasswordRef & {ref: "op://Employee/Infisical/machine-identity/client-id"}
			INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET: schema.#OnePasswordRef & {ref: "op://Employee/Infisical/machine-identity/client-secret"}
			GOOGLE_OAUTH_CLIENT_ID: schema.#OnePasswordRef & {ref: "op://Employee/565nub77bcoxqd5a77kbdets3q/youtube-control/client-id"}
			GOOGLE_OAUTH_CLIENT_SECRET: schema.#OnePasswordRef & {ref: "op://Employee/565nub77bcoxqd5a77kbdets3q/youtube-control/client-secret"}
		}
	}

	verify: schema.#Task & {
		command: "bash"
		args: ["-c", _npm + "bash scripts/verify.sh"]
		inputs: list.Concat([_sources, ["scripts/verify.sh"]])
		labels: ["infisical"]
		env: BASIN_SQL_TOKEN: _youtubeSecret & {secretName: "BASIN_SQL_TOKEN"}
	}

	inspect: schema.#Task & {
		command: "bash"
		args: ["scripts/inspect-likes.sh"]
		inputs: ["scripts/inspect-likes.sh"]
		labels: ["infisical"]
		env: BASIN_SQL_TOKEN: _youtubeSecret & {secretName: "BASIN_SQL_TOKEN"}
	}

	// Starts another history load; see scripts/backfill.sh.
	backfill: schema.#Task & {
		command: "sh"
		args: ["-c", _npm + "bash scripts/backfill.sh"]
		inputs: list.Concat([_sources, ["scripts/backfill.sh"]])
	}
}
