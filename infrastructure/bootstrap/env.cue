package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "infrastructure-bootstrap"

let _infrastructure = [{allowInfrastructure: ["plan", "apply", "import", "destroy"]}]

// Run by hand, because CI's Infisical access comes from here. cuenv needs the
// admin identity to read the root token, and the Infisical provider needs it
// separately:
//
//	op run --env-file=infrastructure/bootstrap/op.env -- cuenv i plan --path infrastructure/bootstrap
env: {
	CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce"

	// Saved in Infisical by hand: Cloudflare won't let a token created through
	// the API create other tokens.
	CLOUDFLARE_API_TOKEN: {
		value: schema.#InfisicalSecret & {
			projectId:   "6575a392d7a5ef0555ade86b"
			environment: "production"
			secretPath:  "/infrastructure"
			secretName:  "CLOUDFLARE_ROOT_TOKEN"
			apiUrl:      "https://app.infisical.com"
		}
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
