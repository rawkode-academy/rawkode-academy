package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-transcriptions"

env: {
	SERVICE_NAME: "transcriptions"

	environment: production: {
		CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/cloudflare/api-tokens/workers"
		}
		DEEPGRAM_API_KEY: schema.#OnePasswordRef & {
			ref: "op://Employee/Deepgram/api-tokens/restate"
		}
		HTTP_TRANSCRIPTION_TOKEN: schema.#OnePasswordRef & {
			ref: "op://Employee/w3etxulw37bsqb2rsna5px7y4u/http-tokens/http-transcription-token"
		}
	}
}

ci: pipelines: [
	{
		name:        "default"
		environment: "production"
		when: {
			branch:        ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: ["deploy"]
	},
]

tasks: {
	deploy: {
		command: "bun"
		args: ["x", "wrangler", "deploy", "--config", "./wrangler.jsonc"]
		workspaces: ["bun"]
	}
	"check-missing": {
		command: "bun"
		args: ["scripts/schedule_missing.ts"]
		workspaces: ["bun"]
	}
	"schedule-missing": {
		command: "bun"
		args: ["scripts/schedule_missing.ts", "--execute"]
		workspaces: ["bun"]
	}
}
