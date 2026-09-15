package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "klusteredbench"

env: {
	environment: production: {
		ANTHROPIC_API_KEY: schema.#OnePasswordRef & {ref: "op://sa.rawkode.academy/anthropic/api-key"}
	}
}

let _t = tasks

tasks: {
	check: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "check"]
		inputs: ["src/**", "test/**", "tsconfig.json", "package.json"]
	}

	test: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "test"]
		inputs: ["src/**", "test/**", "scenarios/**", "package.json"]
	}

	// Proves every scenario is broken after `break` and green after `solve`.
	// Needs docker + kind on the host.
	validate: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "src/cli.ts", "scenarios", "validate"]
		dependsOn: [_t.check]
	}

	run: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "src/cli.ts", "run"]
		dependsOn: [_t.check]
	}
}
