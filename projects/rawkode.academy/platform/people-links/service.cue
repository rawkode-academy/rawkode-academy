package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// People links: extra links on a person's profile.
_service: gen.#PlatformService & {
	serviceName:       "people-links"
	contentWriteModel: true
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-people-links"
			// Restored from the service removed in #769; recreate it if it no longer exists.
			databaseId: "a9fd441c-34f3-4f1d-a4c0-875d2716e694"
		}]
	}
}

codegen: _service.codegen
