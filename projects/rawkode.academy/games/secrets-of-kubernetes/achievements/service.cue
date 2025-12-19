package cuenv

import "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/cubes"

_service: cubes.#PlatformService & {
	serviceName:      "ski-achievements"
	servicePrefix:    "games"
	includeReadModel: false
	includeHttp:      true
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "games-ski-achievements"
			databaseId:   "e2bf9ae1-d84e-4b01-b3dc-5213299b9c3c"
		}]
	}
}

cube: _service.cube
