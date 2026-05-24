package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

_service: gen.#PlatformService & {
	serviceName:       "brackets"
	includeWriteModel: true
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-brackets"
			databaseId:   "d8241042-0b2b-4d7a-881f-eff9df812c62"
		}]
		workflows: [{
			binding:   "generateBracket"
			name:      "generate-bracket"
			className: "GenerateBracketWorkflow"
		}, {
			binding:   "recordResult"
			name:      "record-result"
			className: "RecordResultWorkflow"
		}]
	}
}

codegen: _service.codegen
