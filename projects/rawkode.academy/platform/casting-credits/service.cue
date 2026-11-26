package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Casting credits: which people play which role on which subject (a video, a
// show, an episode, a course). The source of truth for who was on screen.
_service: gen.#PlatformService & {
	serviceName: "casting-credits"
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-casting-credits"
			databaseId:   "52ed26af-1541-4a07-8c71-7b8ec252b9d4"
		}]
	}
}

codegen: _service.codegen
