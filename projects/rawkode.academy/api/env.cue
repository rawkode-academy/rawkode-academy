package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-api"

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
	"collect-schemas": {
		command: "bun"
		args: ["run", "scripts/collect-schemas.ts"]
		dependsOn: ["install"]
	}
	compose: {
		command: "bun"
		args: ["run", "scripts/compose.ts"]
		dependsOn: ["collect-schemas"]
	}
	deploy: {
		command: "npx"
		args: ["wrangler", "deploy"]
		dependsOn: ["compose"]
	}
}
