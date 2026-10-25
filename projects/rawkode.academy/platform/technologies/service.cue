package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Technologies: the Technology entity and its profile. Terms and video links live in join services.
_service: gen.#PlatformService & {
	serviceName:       "technologies"
	contentWriteModel: true
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-technologies"
			// Restored from the service removed in #769; recreate it if it no longer exists.
			databaseId: "4671b796-cdc8-4a4e-aa58-4e10eb24b67d"
		}]
	}
}

codegen: _service.codegen
