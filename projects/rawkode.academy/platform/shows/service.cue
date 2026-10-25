package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Shows: the Show entity. Hosts, episodes and terms live in join services.
_service: gen.#PlatformService & {
	serviceName:       "shows"
	contentWriteModel: true
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-shows"
			// Restored from the service removed in #769; recreate it if it no longer exists.
			databaseId: "533025e2-2267-41e8-bf38-ad171a0d9de4"
		}]
	}
}

codegen: _service.codegen
