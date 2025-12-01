package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Cuenv

env: {
	R2_BUCKET_NAME: "rawkode-academy-content"

	environment: production: {
		R2_ACCOUNT_ID: schema.#OnePasswordRef & {
			ref: "op://Employee/w3etxulw37bsqb2rsna5px7y4u/api-tokens/account-id"
		}
		R2_ACCESS_KEY_ID: schema.#OnePasswordRef & {
			ref: "op://Employee/w3etxulw37bsqb2rsna5px7y4u/rawkode-academy-content/access-key-id"
		}
		R2_SECRET_ACCESS_KEY: schema.#OnePasswordRef & {
			ref: "op://Employee/w3etxulw37bsqb2rsna5px7y4u/rawkode-academy-content/secret-access-key"
		}
	}
}

tasks: {
	run: {
		command: "bun"
		args: ["run", "start"]
	}
}
