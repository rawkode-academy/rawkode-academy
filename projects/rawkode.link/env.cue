package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-link"

workspaces: bun: {}



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
	deploy: {
		command: "bun"
		args: ["x", "wrangler", "deploy"]
		workspaces: ["bun"]
	}
}
