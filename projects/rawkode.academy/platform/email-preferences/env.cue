package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-email-preferences"
_flakeRoot: "../../../.."

env: {
	SERVICE_NAME: "email-preferences"
}

ci:      _service.ci
tasks:   _service.tasks
codegen: _service.codegen
