package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-api"

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
	"collect-schemas": {
		command: "bun"
		args: ["run", "scripts/collect-schemas.ts"]
	}
	compose: {
		command: "bun"
		args: ["run", "scripts/compose.ts"]
		dependsOn: ["collect-schemas"]
	}
	deploy: {
		command: "bun"
		args: ["x", "wrangler", "deploy"]
		dependsOn: ["compose"]
	}
}
