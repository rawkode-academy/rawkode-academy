package cuenv

import (
	"github.com/cuenv/cuenv/schema"
	"github.com/cuenv/cuenv/contrib/nix"
)

schema.#Project

name: "rawkode-cloud"

hooks: onEnter: shell: nix.#NixFlake

env: environment: production: {
	INFISICAL_UNIVERSAL_AUTH_CLIENT_ID: schema.#OnePasswordRef & {ref: "op://Employee/Infisical/machine-identity/client-id"}
	INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET: schema.#OnePasswordRef & {ref: "op://Employee/Infisical/machine-identity/client-secret"}
	SCW_ACCESS_KEY: schema.#OnePasswordRef & {ref: "op://rawkode.cloud/scaleway/username"}
	SCW_SECRET_KEY: schema.#OnePasswordRef & {ref: "op://rawkode.cloud/scaleway/password"}
	SCW_DEFAULT_PROJECT_ID:      "6f6da5bd-f7a3-45ac-b0f1-3aae5bd0f436"
	SCW_DEFAULT_ORGANIZATION_ID: "b07462e9-1a00-43b4-a6a8-6e3004a31984"
	AWS_ACCESS_KEY_ID: schema.#OnePasswordRef & {ref: "op://rawkode.cloud/scaleway/username"}
	AWS_SECRET_ACCESS_KEY: schema.#OnePasswordRef & {ref: "op://rawkode.cloud/scaleway/password"}
}

tasks: {
	init: {
		command: "tofu"
		args: ["-chdir=tofu", "init"]
	}

	plan: {
		command: "tofu"
		args: ["-chdir=tofu", "plan"]
		dependsOn: [tasks.init]
	}

	apply: {
		command: "tofu"
		args: ["-chdir=tofu", "apply", "-auto-approve"]
		dependsOn: [tasks.init]
	}
}
