package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-tools-posthog-collector"

env: {
	SERVICE_NAME: "posthog-collector"

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
	dev: {
		command: "bunx"
		args: ["wrangler", "dev"]
	}

	deploy: {
		command: "bunx"
		args: ["wrangler", "deploy"]
	}

	typegen: {
		command: "bunx"
		args: ["wrangler", "types", "--env-interface", "CloudflareBindings"]
	}
}
