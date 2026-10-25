package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Show hosts: which people host which shows.
_service: gen.#PlatformService & {
	serviceName:       "show-hosts"
	contentWriteModel: true
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-show-hosts"
			// Restored from the service removed in #769; recreate it if it no longer exists.
			databaseId: "e5252389-4324-4745-a70d-d18e0f03ccff"
		}]
	}
}

codegen: _service.codegen
