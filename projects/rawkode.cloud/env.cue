package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-cloud"

config: infisical: defaultEnvironment: "development"

env: {
	environment: production: {
		// Infisical bootstrap. `rkc` uses these to backfill missing values
		// such as SCW keys, cluster name, offer ID, OS ID, and teleport proxy.
		RAWKODE_CLOUD_INFISICAL_CLIENT_ID:     schema.#OnePasswordRef & {ref: "op://Employee/Infisical/machine-identity/client-id"}
		RAWKODE_CLOUD_INFISICAL_CLIENT_SECRET: schema.#OnePasswordRef & {ref: "op://Employee/Infisical/machine-identity/client-secret"}

		// Scaleway credentials (both RAWKODE_CLOUD_* and SCW_* are supported).
		RAWKODE_CLOUD_SCALEWAY_ACCESS_KEY: schema.#OnePasswordRef & {ref: "op://rawkode.cloud/scaleway/username"}
		RAWKODE_CLOUD_SCALEWAY_SECRET_KEY: schema.#OnePasswordRef & {ref: "op://rawkode.cloud/scaleway/password"}
		SCW_ACCESS_KEY:                    schema.#OnePasswordRef & {ref: "op://rawkode.cloud/scaleway/username"}
		SCW_SECRET_KEY:                    schema.#OnePasswordRef & {ref: "op://rawkode.cloud/scaleway/password"}
		SCW_DEFAULT_PROJECT_ID:            "6f6da5bd-f7a3-45ac-b0f1-3aae5bd0f436"
		SCW_DEFAULT_ORGANIZATION_ID:       "b07462e9-1a00-43b4-a6a8-6e3004a31984"

		// Kept for Scaleway S3/OpenTofu compatibility if needed elsewhere.
		AWS_ACCESS_KEY_ID:     schema.#OnePasswordRef & {ref: "op://rawkode.cloud/scaleway/username"}
		AWS_SECRET_ACCESS_KEY: schema.#OnePasswordRef & {ref: "op://rawkode.cloud/scaleway/password"}
	}
}

tasks: {
	bootstrap: {
		command: "./rkc"
		args: ["bootstrap", "--environment", "production", "--output", "production.yaml"]
	}

	provision: {
		command: "./rkc"
		args: ["provision"]
	}
}
