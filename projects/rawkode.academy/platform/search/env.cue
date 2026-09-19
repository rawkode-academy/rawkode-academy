package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-search"

let _t = tasks

ci: pipelines: {
	default: {
		environment: "production"
		when: {
			branch: ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: [_t.check, _t.test]
	}
}

tasks: {
	check: schema.#Task & {
		hermetic: false
		command: "cargo"
		args: ["check", "--locked"]
	}
	test: schema.#Task & {
		hermetic: false
		command: "cargo"
		args: ["test", "--locked"]
	}
}
