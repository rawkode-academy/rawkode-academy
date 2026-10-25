package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Video technologies: which technologies each video covers.
_service: gen.#PlatformService & {
	serviceName:       "video-technologies"
	contentWriteModel: true
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-video-technologies"
			// Restored from the service removed in #769; recreate it if it no longer exists.
			databaseId: "fcbbfbca-d078-49a5-b9cb-edf6b17592a0"
		}]
	}
}

codegen: _service.codegen
