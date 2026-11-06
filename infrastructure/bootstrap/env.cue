package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "infrastructure-bootstrap"

let _infrastructure = [{allowInfrastructure: ["plan", "apply", "import", "destroy"]}]

// Made in the dashboard: Cloudflare won't let a token created through the API
// create other tokens.
_rootToken: schema.#OnePasswordRef & {ref: "op://Employee/Cloudflare/api-tokens/all-access"}

// Run by hand with 1Password credentials: everything CI needs comes from here,
// so this project can't depend on any of it.
env: {
	CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce"

	CLOUDFLARE_API_TOKEN: {
		value: _rootToken
		policies: _infrastructure
	}
	INFISICAL_UNIVERSAL_AUTH_CLIENT_ID: {
		value: schema.#OnePasswordRef & {ref: "op://Employee/Infisical/machine-identity/client-id"}
		policies: _infrastructure
	}
	INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET: {
		value: schema.#OnePasswordRef & {ref: "op://Employee/Infisical/machine-identity/client-secret"}
		policies: _infrastructure
	}
}
