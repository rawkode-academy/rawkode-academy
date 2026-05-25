package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-link"

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
		tasks: [_t.deploy]
	}
}

tasks: {
	deploy: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["x", "wrangler", "deploy"]
	}
}
