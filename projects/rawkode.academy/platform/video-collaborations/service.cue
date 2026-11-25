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
			// TODO: replace with the id of the created D1 database before merging.
			databaseId: "00000000-0000-0000-0000-000000000000"
		}]
	}
}

codegen: _service.codegen
