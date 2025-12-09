package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Cuenv

env: {
	GRAPHQL_ENDPOINT: "https://api.rawkode.academy/"
	DISABLE_GAME_AUTH: true
}

hooks: onEnter: devenv: {
	command: "devenv"
	args: ["print-dev-env"]
	source: true
}

workspaces: bun: {}

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
