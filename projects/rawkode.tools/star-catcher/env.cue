package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-tools-star-catcher"

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
				inputs: ["wrangler.jsonc"]
			outputs: ["worker-configuration.d.ts"]
		}
	}

	dev: {
		command: "bun"
		args: ["x", "wrangler", "dev"]
		dependsOn: ["cloudflare.types"]
	}

	deploy: {
		command: "bun"
		args: ["x", "wrangler", "deploy"]
		dependsOn: ["cloudflare.types"]
	}
}
