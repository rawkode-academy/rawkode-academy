package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "klustered-live"

let _t = tasks

tasks: {
	dev: schema.#Task & {
		command: "deno"
		args: ["task", "dev"]

		inputs: [
			"astro.config.mjs",
			"deno.json",
			"public/**",
			"src/**",
		]
	}

	build: schema.#Task & {
		command: "deno"
		args: ["task", "build"]

		inputs: [
			"astro.config.mjs",
			"deno.json",
			"public/**",
			"src/**",
		]

		outputs: [
			"dist/**",
		]
	}

	check: schema.#Task & {
		command: "deno"
		args: ["task", "check"]

		inputs: [
			"astro.config.mjs",
			"deno.json",
			"src/**",
			"tsconfig.json",
		]
	}
}
