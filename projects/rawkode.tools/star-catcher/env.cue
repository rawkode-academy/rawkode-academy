package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Cuenv

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
		name: "default"
		when: {
			branch: ["main"]
			defaultBranch: true
		}
		tasks: ["deploy"]
	},
]

tasks: {
	cloudflare: {
		types: {
			command: "bunx"
			args: ["wrangler", "types"]
			inputs: ["wrangler.jsonc"]
			outputs: ["worker-configuration.d.ts"]
		}
	}

	dev: {
		command: "bunx"
		args: ["wrangler", "dev"]
		dependsOn: ["cloudflare.types"]
	}

	deploy: {
		command: "bunx"
		args: ["wrangler", "deploy"]
		dependsOn: ["cloudflare.types"]
	}
}
