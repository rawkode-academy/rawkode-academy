package cuenv

import "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/cubes"

_service: cubes.#PlatformService & {
	serviceName:       "emoji-reactions"
	includeWriteModel: true
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

cube: _service.cube
