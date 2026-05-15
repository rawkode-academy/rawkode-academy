package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-link"

let _t = tasks

ci: pipelines: {
	default: {
		environment: "production"
		when: {
			branch:        ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: [_t.deploy]
	}
}

tasks: {
	deploy: schema.#Task & {
		command: "bun"
		args: ["x", "wrangler", "deploy"]
	}
}
