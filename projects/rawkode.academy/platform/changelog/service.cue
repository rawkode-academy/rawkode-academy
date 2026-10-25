package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Changelog: the ChangelogEntry entity. Authors are Person references.
_service: gen.#PlatformService & {
	serviceName: "changelog"
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
			databaseName: "platform-changelog"
			databaseId:   "3f083687-1468-4cdb-85e1-4478a5ea14b6"
		}]
	}
}

codegen: _service.codegen
