package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-api"

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
		tasks: ["install", "deploy"]
	},
]

tasks: {
	"collect-schemas": {
		command: "bun"
		args: ["run", "scripts/collect-schemas.ts"]
		workspaces: ["bun"]
	}
	compose: {
		command: "bun"
		args: ["run", "scripts/compose.ts"]
		workspaces: ["bun"]
		dependsOn: ["collect-schemas"]
	}
	deploy: {
		command: "bun"
		args: ["x", "wrangler", "deploy"]
		workspaces: ["bun"]
		dependsOn: ["compose"]
	}
}
