package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// People biographies: the Markdown biography on a person's profile.
_service: gen.#PlatformService & {
	serviceName:       "people-biographies"
	contentWriteModel: true
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-people-biographies"
			// Restored from the service removed in #769; recreate it if it no longer exists.
			databaseId: "6ae3c7be-86f1-4385-9d07-629969b0f950"
		}]
	}
}

codegen: _service.codegen
