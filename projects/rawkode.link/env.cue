package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

env: {
	environment: production: {
		CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
			ref: "op://Employee/w3etxulw37bsqb2rsna5px7y4u/api-tokens/all-access"
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
	install: {
		command: "bun"
		args: ["install"]
	}
	deploy: {
		command: "npx"
		args: ["wrangler", "deploy"]
		dependsOn: ["install"]
	}
}
