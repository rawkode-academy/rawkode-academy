package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

// rawkode.chat: the Waddle web client, deployed from the build Waddle's CI
// publishes (ghcr.io/waddle-social/waddle/chat-dist:main) and pointed at the
// hosted Waddle tenant at waddle.rawkode.chat.
name: "rawkode-chat"

let _t = tasks

ci: pipelines: {
	default: {
		environment: "production"
		when: {
			branch: ["main"]
			defaultBranch: true
			manual:        true
			// The hosted server runs waddle:main, so the client follows
			// chat-dist:main; the daily run picks up new upstream builds.
			scheduled: "17 5 * * *"
		}
		tasks: [_t.deploy]
	}
}

tasks: {
	// Pulls the published client, rewrites its wrangler config with the
	// rawkode.chat identity and deploys it, all in one task: cuenv gives each
	// task its own TMPDIR, so nothing is handed between tasks.
	deploy: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["deploy.ts"]
	}
}
