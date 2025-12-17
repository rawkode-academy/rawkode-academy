package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Base

env: {
	environment: production: {
		CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce"

		// It's mostly me, @rawkode, that works on this project. As such,
		// this AAA/Root token is configured; but whenever we need to expose
		// commands or Cloudflare access to others, we will override this reference
		// per project.
		AAA_CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
			ref: "op://Employee/w3etxulw37bsqb2rsna5px7y4u/api-tokens/all-access"
		}
		TF_WORKSPACE: "production"
	}
}

workspaces: bun: {
	hooks: {
		beforeInstall: [
			// Set up projen-platform-service before generators run
			schema.#TaskRef & {ref: "#projen-generator:types"},
			schema.#MatchHook & {match: labels: ["projen"]},
		]
	}
}
