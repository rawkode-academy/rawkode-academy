package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Video channels: where each Academy video lives on external platforms
// (YouTube, X, LinkedIn, ...), as platform + external id.
_service: gen.#PlatformService & {
	serviceName: "video-channels"
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-video-channels"
			databaseId:   "00e10bc1-5c76-45ac-9b4d-a2f14dcbfd15"
		}]
	}
}

codegen: _service.codegen
