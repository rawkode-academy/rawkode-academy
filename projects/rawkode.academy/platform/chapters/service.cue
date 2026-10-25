package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Chapters: timestamped sections of a video.
_service: gen.#PlatformService & {
	serviceName:       "chapters"
	contentWriteModel: true
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-chapters"
			// Restored from the service removed in #769; recreate it if it no longer exists.
			databaseId: "c388193d-ef24-4016-827b-ab57a887ee4e"
		}]
	}
}

codegen: _service.codegen
