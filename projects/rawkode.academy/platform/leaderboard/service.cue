package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

_service: gen.#PlatformService & {
	serviceName:      "leaderboard"
	servicePrefix:    "platform"
	includeReadModel: false
	includeHttp:      true
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "leaderboard"
			databaseId:   "20f8fa9e-58b7-45e6-b8d6-d961f1ba84b0"
		}]
	}
}

codegen: _service.codegen
