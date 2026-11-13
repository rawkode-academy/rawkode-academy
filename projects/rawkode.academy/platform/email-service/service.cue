package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

_service: gen.#PlatformService & {
	serviceName:       "email-service"
	includeDataModel:  false
	includeReadModel:  false
	includeWriteModel: false
	includeHttp:       true
	additionalDependencies: {
		cloudevents: "^8.0.2"
	}
	additionalDevDependencies: {
		vitest: "^4.1.8"
	}
	bindings: {
		sendEmail: [{
			name: "SEND_EMAIL"
		}]
		services: [{
			binding: "EMAIL_PREFERENCES"
			service: "platform-email-preferences-rpc"
		}]
	}
}

codegen: _service.codegen
