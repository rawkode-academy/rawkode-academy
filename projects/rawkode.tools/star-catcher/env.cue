package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-tools-star-catcher"

workspaces: bun: {}

env: {
	SERVICE_NAME: "star-catcher"

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
	cloudflare: {
		types: {
			command: "bun"
			args: ["x", "wrangler", "types"]
			workspaces: ["bun"]
			inputs: ["wrangler.jsonc"]
			outputs: ["worker-configuration.d.ts"]
		}
	}

	dev: {
		command: "bun"
		args: ["x", "wrangler", "dev"]
		workspaces: ["bun"]
		dependsOn: ["cloudflare.types"]
	}

	deploy: {
		command: "bun"
		args: ["x", "wrangler", "deploy"]
		workspaces: ["bun"]
		dependsOn: ["cloudflare.types"]
	}
}
