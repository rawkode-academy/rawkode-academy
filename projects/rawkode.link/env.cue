package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-link"
_flakeRoot: "../.."

// Deploys with the base dev shell's Bun, like every project without its own
// shell. (The old devenv runtime made every CI deploy since July fail to spawn
// bun; that runtime is gone.)

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
