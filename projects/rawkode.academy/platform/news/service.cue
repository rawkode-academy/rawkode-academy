package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// News: editorial news stories, with their authors and technologies.
_service: gen.#PlatformService & {
	serviceName: "news"
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
			databaseName: "platform-news"
			databaseId:   "7bcc5595-2a1e-40f7-9fce-3cb8b082ada3"
		}]
	}
}

codegen: _service.codegen
