package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

// rawkode.chat: the Waddle web client, built from upstream waddle-social/waddle
// and pointed at the hosted Waddle tenant at waddle.rawkode.chat.
name: "rawkode-chat"

let _t = tasks

env: {
	// Track upstream main: the hosted server runs waddle:main, so the client
	// follows it. The daily run below picks up client changes made upstream.
	WADDLE_REF: "main"
}

ci: pipelines: {
	default: {
		environment: "production"
		when: {
			branch: ["main"]
			defaultBranch: true
			manual:        true
			scheduled:     "17 5 * * *"
		}
		tasks: [_t.deploy]
	}
}

tasks: {
	build: schema.#Task & {
		hermetic: false
		command:  "bash"
		args: ["waddle.sh", "build"]
	}

	deploy: schema.#Task & {
		hermetic: false
		command:  "bash"
		args: ["waddle.sh", "deploy"]
		dependsOn: [_t.build]
	}
}
