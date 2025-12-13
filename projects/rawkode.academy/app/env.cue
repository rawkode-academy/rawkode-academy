package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-app"

env: {
	GRAPHQL_ENDPOINT: "https://api.rawkode.academy/"
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
			"package.json",
			"panda.config.ts",
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
			"package.json",
			"panda.config.ts",
			"public/",
			"src/**",
		]
	}

	deploy: {
		command: "bunx"
		args: ["wrangler", "deploy"]
	}
}
