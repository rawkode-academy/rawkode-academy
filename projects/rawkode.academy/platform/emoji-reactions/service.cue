package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

_service: gen.#PlatformService & {
	serviceName:       "emoji-reactions"
	includeWriteModel: true
	// Its tests target vitest-pool-workers and fail under bun test; see #1715.
	ciTests: false
	additionalDependencies: {
		"better-auth": "^1.4.1"
		cloudevents:   "^8.0.2"
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
