package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Cuenv

env: {
	GITHUB_OWNER: "RawkodeAcademy"

	environment: production: {
		GITHUB_CLIENT_ID: schema.#OnePasswordRef & {
			ref: "op://Private/github-app-rawkode-academy/username"
		}
		GITHUB_CLIENT_SECRET: schema.#OnePasswordRef & {
			ref: "op://Private/github-app-rawkode-academy/password"
		}
		CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
			ref: "op://Private/w3etxulw37bsqb2rsna5px7y4u/api-tokens/all-access"
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
