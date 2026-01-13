package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-link"

ci: pipelines: {
	default: {
		environment: "production"
		when: {
			branch:        ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: [tasks.deploy]
	}
}

tasks: {
	deploy: {
		command: "bun"
		args: ["x", "wrangler", "deploy"]
	}
}
