package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-api"

let _t = tasks

// Run tasks non-hermetically so bun resolves on PATH (cuenv v0.42.0 hermetic
// task spawn cannot find bare commands like `bun`).
tasks: [string]: hermetic: false

ci: pipelines: {
	default: {
		environment: "production"
		when: {
			branch: ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: [_t.deploy]
	}
}

tasks: {
	collectSchemas: schema.#Task & {
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
	compose: schema.#Task & {
		command: "bun"
		args: ["run", "scripts/compose.ts"]
		dependsOn: [_t.collectSchemas]

		inputs: [
			"scripts/compose.ts",
			"schemas/**",
		]

		outputs: [
			"supergraph.graphql",
		]
	}
	deploy: schema.#Task & {
		command: "bun"
		args: ["x", "wrangler", "deploy"]
		dependsOn: [_t.compose]

		inputs: [
			"src/**",
			"supergraph.graphql",
			"wrangler.jsonc",
			"package.json",
		]
	}
}
