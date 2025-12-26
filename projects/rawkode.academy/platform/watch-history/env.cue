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
		tasks: ["install", "deploy"]
	},
	{
		name: "pull-request"
		when: pullRequest: true
		tasks: ["install"]
	},
]

tasks: {
	install: {
		command: "bun"
		args: ["install"]
	}
	deploy: {
		read: {
			command: "npx"
			args: ["wrangler", "deploy", "--config", "./read-model/wrangler.jsonc"]
		}
		write: {
			command: "npx"
			args: ["wrangler", "deploy", "--config", "./write-model/wrangler.jsonc"]
		}
		dependsOn: ["install"]
	}
}
