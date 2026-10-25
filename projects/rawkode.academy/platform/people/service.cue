package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// People: the Person entity (names and social handles). Biographies, links and terms live in their own join services.
_service: gen.#PlatformService & {
	serviceName:       "people"
	contentWriteModel: true
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-people"
			// Restored from the service removed in #769; recreate it if it no longer exists.
			databaseId: "d2cd6600-ca32-47d8-bc7d-147c6c7bb794"
		}]
	}
}

codegen: _service.codegen
