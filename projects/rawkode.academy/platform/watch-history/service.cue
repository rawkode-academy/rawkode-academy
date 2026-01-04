package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

_service: gen.#PlatformService & {
	serviceName:       "watch-history"
	includeWriteModel: true
	additionalDependencies: {
		"better-auth": "^1.4.1"
		cloudevents:   "^8.0.2"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-watch-history"
			databaseId:   "ad92ad11-c455-4449-adae-3fcd0b43df99"
		}]
		workflows: [{
			binding:   "updateWatchPosition"
			name:      "update-watch-position"
			className: "UpdateWatchPositionWorkflow"
		}]
	}
}

codegen: _service.codegen
