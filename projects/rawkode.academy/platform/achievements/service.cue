package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

_service: gen.#PlatformService & {
	serviceName:       "achievements"
	servicePrefix:     "platform"
	includeWriteModel: true
	additionalDependencies: {
		"@pothos/plugin-drizzle": "^0.8.1"
		"graphql-scalars":        "^1.24.2"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "achievements"
			databaseId:   "83625427-47af-40ea-907e-d6682a93036a"
		}]
	}
}

codegen: _service.codegen
