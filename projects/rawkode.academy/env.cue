package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Cuenv

env: {
	AUTH_SECRET:                "dummy-for-cli"
	GITHUB_OAUTH_CLIENT_ID:     "dummy"
	GITHUB_OAUTH_CLIENT_SECRET: "dummy"

	environment: production: {
		AUTH_SECRET: schema.#OnePasswordRef & {ref: "op://sa.rawkode.academy/identity/auth-token"}
		CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {ref: "op://sa.rawkode.academy/cloudflare/api-tokens/workers"}
		GITHUB_OAUTH_CLIENT_ID: schema.#OnePasswordRef & {ref: "op://sa.rawkode.academy/identity/github-oauth/client-id"}
	}
}
