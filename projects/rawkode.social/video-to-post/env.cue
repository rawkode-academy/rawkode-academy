package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-social-video-to-post"

runtime: schema.#DevenvRuntime
hooks: onEnter: devenv: schema.#Devenv

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
	}
}
