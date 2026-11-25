package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Video collaborations: which videos are made with a company, and who that company is.
_service: gen.#PlatformService & {
	serviceName: "video-collaborations"
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-video-collaborations"
			databaseId:   "4f2f882e-1a7f-4873-b5d6-9fc85f9efd4d"
		}]
	}
}

codegen: _service.codegen
