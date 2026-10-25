package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Episodes: a video's place in a show, with its episode code.
_service: gen.#PlatformService & {
	serviceName:       "episodes"
	contentWriteModel: true
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-episodes"
			// Restored from the service removed in #769; recreate it if it no longer exists.
			databaseId: "e1e6c651-f251-486f-94ce-72899f0c4dbf"
		}]
	}
}

codegen: _service.codegen
