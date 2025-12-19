package cuenv

import "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/cubes"

_service: cubes.#PlatformService & {
	serviceName:       "email-preferences"
	includeWriteModel: false
	includeHttp:       true
	additionalDependencies: {
		cloudevents: "^8.0.2"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-email-preferences"
			databaseId:   "d1e7b151-f20f-4470-8c84-266fcb76e84f"
		}]
	}
}

cube: _service.cube
