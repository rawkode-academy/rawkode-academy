package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

_service: gen.#PlatformService & {
	serviceName:       "emoji-reactions"
	includeWriteModel: true
	additionalDependencies: {
		"@pothos/plugin-drizzle": "^0.8.1"
		cloudevents:              "^8.0.2"
	}
	additionalDevDependencies: {
		"@graphql-tools/utils": "^10.8.6"
		miniflare:              "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-emoji-reactions"
			databaseId:   "86e45a3f-6d07-48d7-9bbb-4edfacfbe1ca"
		}]
		workflows: [{
			binding:   "reactToContent"
			name:      "react-to-content"
			className: "ReactToContentWorkflow"
		}]
	}
}

codegen: _service.codegen
