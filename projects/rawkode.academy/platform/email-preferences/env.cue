package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Cuenv

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
	projen: synth: {
		command: "bun"
		args: ["run", ".projenrc.ts"]
		labels: ["projen"]
	}

	deploy: {
		read: {
			command: "npx"
			args: ["wrangler", "deploy", "--config", "./read-model/wrangler.jsonc"]
		}
		http: {
			command: "npx"
			args: ["wrangler", "deploy", "--config", "./http/wrangler.jsonc"]
		}
	}
}
