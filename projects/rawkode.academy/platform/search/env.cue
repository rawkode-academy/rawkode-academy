package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-search"

runtime: schema.#DevenvRuntime
hooks: onEnter: devenv: schema.#Devenv

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
