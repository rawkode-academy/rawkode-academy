package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-email-preferences"

env: {
	SERVICE_NAME: "email-preferences"

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
			branch: ["main"]
			defaultBranch: true
		}
		tasks: ["deploy"]
	},
]

tasks: {
	deploy: {
		read: {
			command: "bun"
			args: ["x", "wrangler", "deploy", "--config", "./read-model/wrangler.jsonc"]
		}
		http: {
			command: "bun"
			args: ["x", "wrangler", "deploy", "--config", "./http/wrangler.jsonc"]
		}
	}
}
