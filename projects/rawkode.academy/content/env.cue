package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-content"
_flakeRoot: "../../.."

env: {
	SERVICE_NAME: "content"
}

ci:      _service.ci
tasks:   _service.tasks
codegen: _service.codegen
