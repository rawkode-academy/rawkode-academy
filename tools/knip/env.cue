package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

// Repository-wide knip (unused files, exports and dependencies). knip runs at
// the module root against every Bun workspace, configured by /knip.json.
name: "knip"

let _t = tasks

ci: pipelines: {
	pullRequest: {
		when: {
			pullRequest: true
		}
		tasks: [_t.check]
	}
}

tasks: {
	check: schema.#Task & {
		hermetic: false
		dir: from: "module"
		command: "bun"
		args: ["run", "knip"]

		inputs: [
			schema.#ModuleFiles & {paths: ["bun.lock", "knip.json", "package.json", "packages/**", "projects/**"]},
			"env.cue",
		]
	}
}
