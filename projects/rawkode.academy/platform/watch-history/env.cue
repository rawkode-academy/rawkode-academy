package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-watch-history"

env: {
	environment: production: {
		CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/cloudflare/api-tokens/workers"
		}
	}
}

ci: pipelines: [
	{
		name:        "default"
		environment: "production"
		when: {
			branch:        ["main"]
			defaultBranch: true
		}
		tasks: ["deploy"]
	},
]

tasks: {
	deploy: {
		read: {
			command: "bunx"
			args: ["wrangler", "deploy", "--config", "./read-model/wrangler.jsonc"]
		}
		write: {
			command: "bunx"
			args: ["wrangler", "deploy", "--config", "./write-model/wrangler.jsonc"]
		}
	}
}
