package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "infrastructure-dns"

_ciInfisicalInfrastructure: true

// The credentials infrastructure/bootstrap writes to Infisical. A reviewed
// apply logs in as github-read-write and reads /infrastructure. A plan logs in
// as github-read-only and reads /infrastructure/github-read-only, which holds
// nothing that can change Cloudflare or the state.
_infisicalSecret: schema.#InfisicalSecret & {
	projectId:   "6575a392d7a5ef0555ade86b"
	environment: "production"
	apiUrl:      "https://app.infisical.com"
}
_readWrite: _infisicalSecret & {secretPath: "/infrastructure"}
_readOnly: _infisicalSecret & {secretPath: "/infrastructure/github-read-only"}

contexts: {
	plan: schema.#When & {infrastructure: "plan"}
	// State commands that write need the read-write state key too.
	apply: schema.#When & {infrastructure: "apply|import|destroy|state-remove"}
}

env: context: {
	plan: {
		CLOUDFLARE_API_TOKEN: _readOnly & {secretName: "CLOUDFLARE_API_TOKEN"}
	}
	apply: {
		CLOUDFLARE_API_TOKEN: _readWrite & {secretName: "CLOUDFLARE_ROOT_TOKEN"}
	}
}
