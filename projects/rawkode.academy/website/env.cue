package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-website"

runtime: schema.#DevenvRuntime
hooks: onEnter: devenv: schema.#Devenv

env: {
	GRAPHQL_ENDPOINT: "https://api.rawkode.academy/"
	DISABLE_GAME_AUTH: true
}

tasks: {
	dev: {
		command: "bun"
		args: ["run", "dev"]

		workspaces: ["bun"]

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

		workspaces: ["bun"]

		inputs: [
			"astro.config.mts",
			"bun.lock",
			"content/",
			"package.json",
			"public/",
			"src/**",
		]

	}

	deploy: {
		command: "bunx"
		args: ["wrangler", "deploy"]
	}
}
