package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-youtube-to-structured-json"

env: {
	environment: production: {
		GEMINI_API_KEY: schema.#OnePasswordRef & {
			ref: "op://Private/Google Gemini/password"
		}
		CLOUDFLARE_R2_ACCESS_KEY: schema.#OnePasswordRef & {
			ref: "op://Employee/w3etxulw37bsqb2rsna5px7y4u/rawkode-academy-videos/access-key"
		}
		CLOUDFLARE_R2_SECRET_KEY: schema.#OnePasswordRef & {
			ref: "op://Employee/w3etxulw37bsqb2rsna5px7y4u/rawkode-academy-videos/secret-key"
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
		tasks: ["install", "run"]
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
	run: {
		command: "bun"
		args: ["run", "start"]
		dependsOn: ["install"]
	}
}
