package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Video collaborations: which videos are made with a company, and who that company is.
_service: gen.#PlatformService & {
	serviceName:        "video-collaborations"
	forwardGatewayAuth: true
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-video-collaborations"
			databaseId:   "4f2f882e-1a7f-4873-b5d6-9fc85f9efd4d"
		}]
		// The website's daily analytics snapshot (analytics:snapshot:v2), read only.
		kvNamespaces: [{
			binding: "ANALYTICS_SNAPSHOT"
			id:      "28d816db99f34b06b48db5fec83bc06d"
		}]
	}
}

codegen: _service.codegen
