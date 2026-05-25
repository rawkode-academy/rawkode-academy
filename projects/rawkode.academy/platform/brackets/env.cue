package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-brackets"

env: {
	environment: production: {
		CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/cloudflare/api-tokens/workers"
		}
	}
}

ci:      _service.ci
tasks:   _service.tasks
codegen: _service.codegen

// Keep the default CI deploy task affected when shared generator/runtime wiring
// changes but GitHub only reports this project path to the workflow.
