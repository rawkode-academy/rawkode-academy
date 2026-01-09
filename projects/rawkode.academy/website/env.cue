package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-website"

env: {
	GRAPHQL_ENDPOINT:  "https://api.rawkode.academy/"
	DISABLE_GAME_AUTH: true
}

ci: pipelines: {
	default: {
		environment: "production"
		when: {
			branch:        ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: ["deploy"]
	}
}

tasks: {
	dev: {
		command: "bun"
		args: ["run", "dev"]


		inputs: [
			"astro.config.mts",
			"bun.lock",
			"content/",
			"package.json",
			"public/",
			"src/**",
		]
	}

	build: {
		command: "bun"
		args: ["run", "build"]


		inputs: [
			"astro.config.mts",
			"bun.lock",
			"content/",
			"package.json",
			"public/",
			"src/**",
		]

		outputs: [
			"dist/**",
		]
	}

	deploy: {
		command: "bun"
		args: ["x", "wrangler", "deploy"]
		dependsOn: [build]
	}
}
