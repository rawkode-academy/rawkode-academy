package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-api"

ci: pipelines: {
	default: {
		environment: "production"
		when: {
			branch:        ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: [tasks.deploy]
	}
}

tasks: {
	"collect-schemas": {
		command: "bun"
		args: ["run", "scripts/collect-schemas.ts"]

		inputs: [
			"scripts/collect-schemas.ts",
			"../platform/*/read-model/schema.gql",
			"../website/schema/*.gql",
		]

		outputs: [
			"schemas/**",
		]
	}
	compose: {
		command: "bun"
		args: ["run", "scripts/compose.ts"]
		dependsOn: [tasks["collect-schemas"]]

		inputs: [
			"scripts/compose.ts",
			"schemas/**",
		]

		outputs: [
			"supergraph.graphql",
		]
	}
	deploy: {
		command: "bun"
		args: ["x", "wrangler", "deploy"]
		dependsOn: [compose]

		inputs: [
			"src/**",
			"supergraph.graphql",
			"wrangler.jsonc",
			"package.json",
		]
	}
}
