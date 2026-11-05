package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "infrastructure-bootstrap"

let _infrastructure = [{allowInfrastructure: ["plan", "apply", "import", "destroy"]}]

// Made in the dashboard: Cloudflare won't let a token created through the API
// create other tokens.
_rootToken: schema.#OnePasswordRef & {ref: "op://Employee/Cloudflare/api-tokens/all-access"}

_infisicalClientId: schema.#OnePasswordRef & {ref: "op://Employee/Infisical/machine-identity/client-id"}
_infisicalClientSecret: schema.#OnePasswordRef & {ref: "op://Employee/Infisical/machine-identity/client-secret"}

// Run by hand with 1Password credentials: everything CI needs comes from here,
// so this project can't depend on any of it.
env: {
	CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce"

	CLOUDFLARE_API_TOKEN: {
		value: _rootToken
		policies: _infrastructure
	}
	INFISICAL_UNIVERSAL_AUTH_CLIENT_ID: {
		value: _infisicalClientId
		policies: _infrastructure
	}
	INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET: {
		value: _infisicalClientSecret
		policies: _infrastructure
	}
}

tasks: "copy-root-token": schema.#Task & {
	hermetic: false
	command:  "bun"
	args: ["copy-root-token.ts"]
	env: {
		CLOUDFLARE_ROOT_TOKEN:   _rootToken
		INFISICAL_CLIENT_ID:     _infisicalClientId
		INFISICAL_CLIENT_SECRET: _infisicalClientSecret
	}
}
