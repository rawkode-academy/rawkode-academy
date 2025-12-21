package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-news"

tasks: {
	dev: {
		command: "bun"
		args: ["run", "dev"]

		workspaces: ["bun"]

		inputs: [
			"astro.config.ts",
			"bun.lock",
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
			"astro.config.ts",
			"bun.lock",
			"package.json",
			"public/",
			"src/**",
		]
	}

	preview: {
		command: "bun"
		args: ["run", "preview"]
	}

	deploy: {
		command: "bunx"
		args: ["wrangler", "deploy"]
	}
}
