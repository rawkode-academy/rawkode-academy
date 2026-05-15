package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "klustered-dev"

let _t = tasks

tasks: {
	codegen: schema.#Task & {
		command: "bun"
		args: ["panda", "codegen"]
	}

	dev: schema.#Task & {
		command: "bun"
		args: ["astro", "dev"]
		dependsOn: [_t.codegen]

		inputs: [
			"astro.config.mjs",
			"bun.lock",
			"package.json",
			"public/",
			"src/**",
		]
	}

	build: schema.#Task & {
		command: "bun"
		args: ["astro", "build"]
		dependsOn: [_t.codegen]

		inputs: [
			"astro.config.mjs",
			"bun.lock",
			"package.json",
			"public/",
			"src/**",
		]
	}

	preview: schema.#Task & {
		command: "bun"
		args: ["astro", "preview"]
	}
}
