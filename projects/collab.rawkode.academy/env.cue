package cuenv

import (
	"list"

	"github.com/cuenv/cuenv/schema"
)

schema.#Project

name: "rawkode-academy-collab"

// Tasks run in this directory's flake.nix dev shell (Node), pinned by
// flake.lock. The Worker holds no secrets: sign-in is a public PKCE client of
// id.rawkode.academy and sessions are opaque ids in KV. Cloudflare access
// comes from the repository-wide token.

let _t = tasks

let _npm = "npm ci --workspaces=false --no-audit --no-fund >/dev/null && "
let _sources = ["src/**", "package.json", "package-lock.json", "wrangler.jsonc", "tsconfig.json", "flake.nix", "flake.lock"]

ci: pipelines: {
	default: {
		environment: "production"
		when: {
			branch: ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: [_t.deploy]
	}

	// Pull requests run the checks and tests; there is no fictional preview.
	pullRequest: {
		environment: "production"
		when: pullRequest: true
		tasks: [_t.check, _t.test]
	}
}

tasks: [string]: hermetic: false

tasks: {
	check: schema.#Task & {
		command: "sh"
		args: ["-c", _npm + "npm run check --workspaces=false"]
		inputs: list.Concat([_sources, ["test/**"]])
	}
	test: schema.#Task & {
		command: "sh"
		args: ["-c", _npm + "npm test --workspaces=false"]
		inputs: list.Concat([_sources, ["test/**"]])
	}

	deploy: schema.#Task & {
		command: "sh"
		args: ["-c", _npm + "npx --no-install tsc --noEmit && npm test --workspaces=false && npx --no-install wrangler deploy"]
		inputs: list.Concat([_sources, ["env.cue", "test/**"]])
	}

}
