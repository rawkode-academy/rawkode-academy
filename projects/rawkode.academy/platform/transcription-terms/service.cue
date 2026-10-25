package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Transcription terms: spellings that help transcribe videos, for videos, shows, people and technologies.
_service: gen.#PlatformService & {
	serviceName:       "transcription-terms"
	contentWriteModel: true
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-transcription-terms"
			// Restored from the service removed in #769; recreate it if it no longer exists.
			databaseId: "0466023a-da45-4b6e-8aed-d638c790be62"
		}]
	}
}

codegen: _service.codegen
