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
		name: "default"
		when: {
			branch:        ["main"]
			defaultBranch: true
		}
		tasks: ["install", "deploy"]
	},
	{
		name: "pull-request"
		when: pullRequest: true
		tasks: ["install"]
	},
]

tasks: {
	install: {
		command: "bun"
		args: ["install"]
	}
	deploy: {
		command: "npx"
		args: ["wrangler", "deploy", "--config", "./wrangler.jsonc"]
		dependsOn: ["install"]
	}
	"check-missing": {
		command: "bun"
		args: ["scripts/schedule_missing.ts"]
		dependsOn: ["install"]
	}
	"schedule-missing": {
		command: "bun"
		args: ["scripts/schedule_missing.ts", "--execute"]
		dependsOn: ["install"]
	}
}
