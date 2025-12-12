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
	projen: {
		command: "bun"
		args: ["run", ".projenrc.ts"]
		labels: ["projen"]
	}
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
