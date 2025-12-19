package cuenv

import "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/cubes"

_service: cubes.#PlatformService & {
	serviceName:      "ski-player-stats"
	servicePrefix:    "games"
	includeReadModel: false
	includeHttp:      true
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "games-ski-player-stats"
			databaseId:   "accba40f-4eae-4cbc-866d-8e28062edafe"
		}]
	}
}

cube: _service.cube
