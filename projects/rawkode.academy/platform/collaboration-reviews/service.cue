package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Collaboration reviews: partners review draft videos made with them, comment on
// moments and sign off. Authorisation comes from the roles and organisations the
// gateway verifies for the caller.
_service: gen.#PlatformService & {
	serviceName:        "collaboration-reviews"
	forwardGatewayAuth: true
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-collaboration-reviews"
			databaseId:   "81bad247-af25-4b7d-9564-a19a54cdace7"
		}]
	}
}

codegen: _service.codegen
