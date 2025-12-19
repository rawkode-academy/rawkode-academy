package cuenv

import "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/cubes"

_service: cubes.#PlatformService & {
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

cube: _service.cube
