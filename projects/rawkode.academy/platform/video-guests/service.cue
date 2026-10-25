package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Video guests: which people appear on which videos.
_service: gen.#PlatformService & {
	serviceName:       "video-guests"
	contentWriteModel: true
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-video-guests"
			// Restored from the service removed in #769; recreate it if it no longer exists.
			databaseId: "97e8a081-fec7-42fe-bf2f-9d7527654bff"
		}]
	}
}

codegen: _service.codegen
