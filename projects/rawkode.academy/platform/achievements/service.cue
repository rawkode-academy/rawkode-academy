package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

_service: gen.#PlatformService & {
	serviceName:      "achievements"
	servicePrefix:    "platform"
	includeReadModel: false
	includeHttp:      true
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "achievements"
			databaseId:   "83625427-47af-40ea-907e-d6682a93036a"
		}]
	}
}

codegen: _service.codegen
