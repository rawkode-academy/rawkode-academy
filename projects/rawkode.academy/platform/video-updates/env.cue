package cuenv

import (
	"list"

	"github.com/cuenv/cuenv/schema"
)

schema.#Project

name: "rawkode-academy-platform-video-updates"

// Updates a video and everything attached to it as a Cloudflare Workflow, then
// publishes an event the YouTube sync consumes. Tasks run in this directory's
// flake.nix dev shell (Bun and Node), pinned by flake.lock.

let _t = tasks

let _sources = ["src/**", "package.json", "wrangler.jsonc", "secrets.env", "flake.nix", "flake.lock", "tsconfig.json"]

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

	// Pull requests run without credentials: tests only.
	pullRequest: {
		when: pullRequest: true
		tasks: [_t.check, _t.test]
	}
}

tasks: [string]: hermetic: false

tasks: {
	check: schema.#Task & {
		command: "bun"
		args: ["run", "check"]
		inputs: _sources
	}

	test: schema.#Task & {
		command: "bun"
		args: ["run", "test"]
		inputs: list.Concat([_sources, ["test/**"]])
	}

	// CI on main: tests, creates the queues if missing (the YouTube sync consumes
	// them, so its deploy creates them too), then deploys the Worker with the
	// website's cache invalidation token.
	deploy: schema.#Task & {
		command: "sh"
		args: ["-c", "bun run check && bun run test && for q in platform-video-updated platform-video-updated-dlq; do bun x wrangler queues info $q >/dev/null 2>&1 || bun x wrangler queues create $q; done && bun x wrangler deploy --secrets-file secrets.env"]
		inputs: list.Concat([_sources, ["env.cue", "test/**"]])
		env: CACHE_INVALIDATION_TOKEN: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/website-cache-invalidation/password"
		}
	}
}
