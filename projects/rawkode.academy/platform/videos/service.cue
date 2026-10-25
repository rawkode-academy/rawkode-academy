package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Videos: the Video entity and its queries. Guests, technologies, chapters, episodes and terms live in join services.
_service: gen.#PlatformService & {
	serviceName:       "videos"
	contentWriteModel: true
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-videos"
			// Restored from the service removed in #769; recreate it if it no longer exists.
			databaseId: "0e96020b-eb03-456c-a593-fa73f2e845d4"
		}]
	}
}

codegen: _service.codegen
