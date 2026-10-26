package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Supporters: community supporters and the technologies they sponsor. Rows are
// seeded by hand until there is a write-model.
_service: gen.#PlatformService & {
	serviceName:       "supporters"
	servicePrefix:     "platform"
	includeWriteModel: false
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-supporters"
			databaseId:   "e1527293-b2d5-4c7f-8d23-5e8bac24f206"
		}]
	}
}

codegen: _service.codegen
