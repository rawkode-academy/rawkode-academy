package cuenv

import "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/cubes"

_service: cubes.#PlatformService & {
	serviceName:       "content"
	includeDataModel:  false
	includeReadModel:  false
	includeWriteModel: false
	includeHttp:       true
	bindings: {
		r2Buckets: [{
			binding:    "CONTENT_BUCKET"
			bucketName: "rawkode-academy-content"
		}]
		routes: [{
			pattern:      "content.rawkode.academy"
			customDomain: true
		}]
	}
}

cube: _service.cube
