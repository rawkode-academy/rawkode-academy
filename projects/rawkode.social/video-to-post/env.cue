package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

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
