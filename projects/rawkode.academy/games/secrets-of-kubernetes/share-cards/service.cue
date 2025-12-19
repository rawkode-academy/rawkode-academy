package cuenv

import "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/cubes"

_service: cubes.#PlatformService & {
	serviceName:       "ski-share-cards"
	servicePrefix:     "games"
	includeDataModel:  false
	includeReadModel:  false
	includeWriteModel: false
	includeHttp:       true
	bindings: {
		r2Buckets: [{
			binding:    "UGC_BUCKET"
			bucketName: "rawkode-academy-ugc"
		}]
	}
}

cube: _service.cube
