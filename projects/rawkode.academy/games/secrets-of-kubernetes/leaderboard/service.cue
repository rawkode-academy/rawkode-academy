package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

_service: gen.#PlatformService & {
	serviceName:      "ski-leaderboard"
	servicePrefix:    "games"
	includeReadModel: false
	includeHttp:      true
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "games-ski-leaderboard"
			databaseId:   "757791da-d31e-476a-a6ab-669ed19d38eb"
		}]
	}
}

codegen: _service.codegen
