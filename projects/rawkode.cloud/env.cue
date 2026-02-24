package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project & {
	name: "rawkode-cloud"

	env: {
		environment: production: {
			// Infisical credentials used by rkc.
			INFISICAL_CLIENT_ID: schema.#OnePasswordRef & {ref: "op://Employee/Infisical/machine-identity/client-id"}
			INFISICAL_CLIENT_SECRET: schema.#OnePasswordRef & {ref: "op://Employee/Infisical/machine-identity/client-secret"}
		}
	}
}
