package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-transcriptions"

let _t = tasks

env: {
	SERVICE_NAME: "transcriptions"

	environment: production: {
		CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/cloudflare/api-tokens/workers"
		}
		HTTP_TRANSCRIPTION_TOKEN: schema.#OnePasswordRef & {
			ref: "op://Employee/w3etxulw37bsqb2rsna5px7y4u/http-tokens/http-transcription-token"
		}
	}
}

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
		args: ["x", "wrangler", "deploy", "--config", "./wrangler.jsonc"]
	}
	"check-missing": schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["scripts/schedule_missing.ts"]
	}
	"schedule-missing": schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["scripts/schedule_missing.ts", "--execute"]
	}
}
