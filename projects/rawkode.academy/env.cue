package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Base

env: {
	AUTH_SECRET:                "dummy-for-cli"
	GITHUB_OAUTH_CLIENT_ID:     "dummy"
	GITHUB_OAUTH_CLIENT_SECRET: "dummy"

	environment: production: {
		AUTH_SECRET: schema.#OnePasswordRef & {ref: "op://sa.rawkode.academy/identity/auth-token"}
		GITHUB_OAUTH_CLIENT_ID: schema.#OnePasswordRef & {ref: "op://sa.rawkode.academy/identity/github-oauth/client-id"}
	}
}
