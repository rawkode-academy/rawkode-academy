package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

env: {
	environment: production: {
		CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/cloudflare/api-tokens/workers"
		}
	}
}

ci: pipelines: [
	{
		name: "default"
		when: {
			branch: ["main"]
			defaultBranch: true
		}
		tasks: ["install", "deploy"]
	},
	{
		name: "pull-request"
		when: pullRequest: true
		tasks: ["install"]
	},
]

tasks: {
	projen: {
		command: "bun"
		args: ["run", ".projenrc.ts"]
		labels: ["projen"]
	}

	deploy: {
		http: {
			command: "bun"
			args: ["run", "wrangler", "deploy", "--config", "./http/wrangler.jsonc"]
		}
	}
}
