package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// ADRs: Architecture Decision Records and their authors.
_service: gen.#PlatformService & {
	serviceName: "adrs"
	// Rich-text bodies are TipTap documents; the read model uses its types.
	additionalDependencies: {
		"@rawkodeacademy/rich-text": "workspace:*"
	}
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-adrs"
			databaseId:   "b448fb63-174d-4bf3-8a14-a763671b6dde"
		}]
	}
}

codegen: _service.codegen
