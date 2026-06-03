package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-transcriptions"

let _t = tasks

// Run tasks non-hermetically so bun resolves on PATH in CI.
tasks: [string]: hermetic: false

env: {
	SERVICE_NAME: "transcriptions"

	environment: production: {
		CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/cloudflare/api-tokens/workers"
		}
	}
}

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
}

tasks: {
	deploy: schema.#Task & {
		command: "/bin/sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun x wrangler deploy --config ./wrangler.jsonc"]
	}
	"check-missing": schema.#Task & {
		command:  "bun"
		args: ["scripts/schedule_missing.ts"]
	}
	"schedule-missing": schema.#Task & {
		command:  "bun"
		args: ["scripts/schedule_missing.ts", "--execute"]
	}
}
