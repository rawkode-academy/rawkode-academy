package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "infrastructure-dns"

// The tokens infrastructure/bootstrap writes to Infisical.
_infrastructureSecret: schema.#InfisicalSecret & {
	projectId:   "6575a392d7a5ef0555ade86b"
	environment: "production"
	apiUrl:      "https://app.infisical.com"
	secretPath:  "/infrastructure"
}

let _infrastructure = [{allowInfrastructure: ["plan", "apply", "import", "destroy"]}]

env: {
	CLOUDFLARE_API_TOKEN: {
		value: _infrastructureSecret & {secretName: "CLOUDFLARE_ROOT_TOKEN"}
		policies: _infrastructure
	}
	DNSIMPLE_TOKEN: {
		value: _infrastructureSecret & {secretName: "DNSIMPLE_TOKEN"}
		policies: _infrastructure
	}
}
