package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Articles: long-form articles, tutorials and guides, with their authors and
// technologies. Bodies are TipTap documents (see packages/rich-text).
_service: gen.#PlatformService & {
	serviceName: "articles"
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-articles"
			databaseId:   "473ef325-9fb9-4f98-9012-8d9d0ac655a3"
		}]
	}
}

codegen: _service.codegen
