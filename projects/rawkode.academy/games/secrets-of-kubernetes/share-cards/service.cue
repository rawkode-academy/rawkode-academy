package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

_service: gen.#PlatformService & {
	serviceName:       "ski-share-cards"
	servicePrefix:     "games"
	includeDataModel:  false
	includeReadModel:  false
	includeWriteModel: false
	includeHttp:       true
	additionalDependencies: {
		"@paralleldrive/cuid2": "^2.2.2"
	}
	bindings: {
		r2Buckets: [{
			binding:    "UGC_BUCKET"
			bucketName: "rawkode-academy-ugc"
		}]
	}
}

codegen: _service.codegen
