package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

_service: gen.#PlatformService & {
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

codegen: _service.codegen
