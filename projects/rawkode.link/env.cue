package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-link"

// No runtime: under the devenv runtime every CI deploy since July failed to
// spawn bun. The collector deploys with CI's own bun, so this does the same.
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
