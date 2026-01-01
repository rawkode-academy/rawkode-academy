package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-tools-observability-collector"

workspaces: bun: {}

env: {
	SERVICE_NAME: "observability-collector"

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
			manual:        true
		}
		tasks: ["deploy"]
	},
]

tasks: {
	dev: {
		command: "bun"
		args: ["x", "wrangler", "dev"]
		workspaces: ["bun"]
	}

	deploy: {
		command: "bun"
		args: ["x", "wrangler", "deploy"]
		workspaces: ["bun"]
	}

	typegen: {
		command: "bun"
		args: ["x", "wrangler", "types", "--env-interface", "CloudflareBindings"]
		workspaces: ["bun"]
	}
}
