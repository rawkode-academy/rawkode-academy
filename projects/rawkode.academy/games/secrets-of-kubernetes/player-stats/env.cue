package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-game-sok-player-stats"

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
		http: {
			command: "bunx"
			args: ["wrangler", "deploy", "--config", "./http/wrangler.jsonc"]
		}
	}
}
