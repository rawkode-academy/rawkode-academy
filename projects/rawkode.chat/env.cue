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
	// Clones Waddle and prints only the checkout path, which build and deploy
	// receive as WADDLE_CHECKOUT (each task gets its own TMPDIR).
	checkout: schema.#Task & {
		hermetic: false
		command:  "bash"
		args: ["waddle.sh", "checkout"]
	}

	build: schema.#Task & {
		hermetic: false
		command:  "bash"
		args: ["waddle.sh", "build"]
		env: WADDLE_CHECKOUT: _t.checkout.stdout
		dependsOn: [_t.checkout]
	}

	deploy: schema.#Task & {
		hermetic: false
		command:  "bash"
		args: ["waddle.sh", "deploy"]
		env: WADDLE_CHECKOUT: _t.checkout.stdout
		dependsOn: [_t.build]
	}
}
