package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Testimonials: quotes from maintainers, partners and viewers, with an embedded author.
_service: gen.#PlatformService & {
	serviceName: "testimonials"
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-testimonials"
			databaseId:   "403fd630-ebee-4fd5-8a26-00336319895a"
		}]
	}
}

codegen: _service.codegen
