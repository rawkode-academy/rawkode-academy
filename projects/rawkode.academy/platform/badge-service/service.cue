package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

_service: gen.#PlatformService & {
	serviceName:       "badge-service"
	includeReadModel:  false
	includeWriteModel: false
	includeHttp:       true
	additionalDependencies: {
		cloudevents: "^10.0.0"
		jose:        "^6.2.2"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-badge"
			databaseId:   "4711df5f-b59b-4eaf-8d88-afe600b75b90"
		}]
		routes: [{
			pattern:      "badges.rawkode.academy"
			customDomain: true
		}]
		secretStoreSecrets: [
			{
				binding:    "BADGE_ISSUER_RSA_PRIVATE_KEY"
				storeId:    "492e5e40b9d64ebeac7e7a77db91ff6e"
				secretName: "BADGE_ISSUER_RSA_PRIVATE_KEY"
			},
			{
				binding:    "BADGE_ISSUER_RSA_PUBLIC_KEY"
				storeId:    "492e5e40b9d64ebeac7e7a77db91ff6e"
				secretName: "BADGE_ISSUER_RSA_PUBLIC_KEY"
			},
			{
				binding:    "BADGE_ISSUER_TOKEN"
				storeId:    "492e5e40b9d64ebeac7e7a77db91ff6e"
				secretName: "BADGE_ISSUER_TOKEN"
			},
		]
		vars: {
			BADGE_ISSUER_URL: "https://badges.rawkode.academy"
		}
	}
}

codegen: _service.codegen
