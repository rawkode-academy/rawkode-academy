package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

hooks: onEnter: nix: schema.#NixFlake

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
