package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-link"



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
