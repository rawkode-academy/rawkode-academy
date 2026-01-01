package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "klustered-dev"

workspaces: bun: {}

tasks: {
	codegen: {
		command: "bun"
		args: ["panda", "codegen"]
		workspaces: ["bun"]
	}

	dev: {
		command: "bun"
		args: ["astro", "dev"]
		workspaces: ["bun"]
		dependsOn: ["codegen"]

		inputs: [
			"astro.config.mjs",
			"bun.lock",
			"package.json",
			"public/",
			"src/**",
		]
	}

	build: {
		command: "bun"
		args: ["astro", "build"]
		workspaces: ["bun"]
		dependsOn: ["codegen"]

		inputs: [
			"astro.config.mjs",
			"bun.lock",
			"package.json",
			"public/",
			"src/**",
		]
	}

	preview: {
		command: "bun"
		args: ["astro", "preview"]
		workspaces: ["bun"]
	}
}
