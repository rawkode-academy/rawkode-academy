package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

_service: gen.#PlatformService & {
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

codegen: _service.codegen
