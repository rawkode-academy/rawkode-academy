package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "klustered-dev"

let _t = tasks

tasks: {
	codegen: {
		command: "deno"
		args: ["task", "codegen"]
	}

	dev: {
		command: "deno"
		args: ["task", "dev"]
		dependsOn: [_t.codegen]

		inputs: [
			"astro.config.mjs",
			"deno.json",
			"deno.lock",
			"public/",
			"src/**",
		]
	}

	build: {
		command: "deno"
		args: ["task", "build"]
		dependsOn: [_t.codegen]

		inputs: [
			"astro.config.mjs",
			"deno.json",
			"deno.lock",
			"public/",
			"src/**",
		]
	}

	preview: {
		command: "deno"
		args: ["task", "preview"]
	}
}
