package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-design-system"

runtime: schema.#DevenvRuntime
hooks: onEnter: devenv: schema.#Devenv

let _t = tasks

ci: pipelines: {
	default: {
		environment: "production"
		when: {
			branch: ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: [_t.check]
	}

	pullRequest: {
		environment: "production"
		when: {
			pullRequest: true
		}
		tasks: [_t.check]
	}
}

tasks: {
	check: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "check"]

		inputs: [
			"../../bun.lock",
			"../../package.json",
			"env.cue",
			"package.json",
			"panda.config.ts",
			"src/**",
			"tsconfig.json",
		]
	}
}
