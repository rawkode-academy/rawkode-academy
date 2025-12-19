package cuenv

import "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/cubes"

_service: cubes.#PlatformService & {
	serviceName:      "ski-player-learned-phrases"
	servicePrefix:    "games"
	includeReadModel: false
	includeHttp:      true
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "games-ski-player-learned-phrases"
			databaseId:   "19c4aaee-cf4b-4d42-8e4b-41219b780590"
		}]
	}
}

cube: _service.cube
