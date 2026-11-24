package cuenv

import (
	"list"

	"github.com/cuenv/cuenv/schema"
	xNix "github.com/cuenv/cuenv/contrib/nix"
)

schema.#Project

name: "rawkode-tools-mcp"

// Tasks run in this directory's flake.nix dev shell (Node), pinned by
// flake.lock.
runtime: schema.#NixRuntime
hooks: onEnter: nix: xNix.#NixFlake

let _t = tasks

// The deploy reads its secrets from Infisical in CI.
_ciInfisicalOidc: true

let _infrastructure = [{allowInfrastructure: ["plan", "apply", "import", "destroy"]}]

// Where the deploy's secrets live. The github-actions identity (deploys on
// main) can read this folder; the collector's infrastructure writes
// BASIN_SQL_TOKEN here.
_secret: _infisicalSecret & {secretPath: "/projects/basin"}

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

	// CI on main: tests, then deploys the Worker with its secret from
	// Infisical.
	deploy: schema.#Task & {
		command: "sh"
		args: ["-c", _npm + "npm test --workspaces=false && npx --no-install wrangler deploy --secrets-file secrets.env"]
		inputs: list.Concat([_sources, ["env.cue", "test/**"]])
		labels: ["infisical"]
		env: BASIN_SQL_TOKEN: _secret & {secretName: "BASIN_SQL_TOKEN"}
	}
}
