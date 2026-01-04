package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-content"

env: {
	SERVICE_NAME: "content"

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
			branch:        ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: ["deploy"]
	}
}

tasks: {
	deploy: {
		command: "bun"
		args: ["x", "wrangler", "deploy", "--config", "./http/wrangler.jsonc"]
	}
}
