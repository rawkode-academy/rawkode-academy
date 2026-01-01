package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-social-video-to-post"

workspaces: bun: {}

env: {
	environment: production: {
		DEEPGRAM_API_KEY: schema.#OnePasswordRef & {
			ref: "op://Employee/Deepgram/password"
		}
	}
}

tasks: {
	run: {
		command: "bun"
		args: ["run", "start"]
		workspaces: ["bun"]
	}
}
