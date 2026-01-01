package cuenv

import "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/cubes"

_service: cubes.#PlatformService & {
	serviceName:       "email-service"
	includeDataModel:  false
	includeReadModel:  false
	includeWriteModel: false
	includeHttp:       true
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

cube:   _service.cube
ignore: _service.ignore
