package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-zitadel-zulip-connector"

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
		tasks: ["deploy"]
	},
]

tasks: {
	deploy: {
		command: "npx"
		args: ["wrangler", "deploy"]
	}
}
