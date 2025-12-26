package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "infrastructure-dns"

runtime: schema.#NixRuntime
hooks: onEnter: nix: schema.#NixFlake

env: {
	environment: production: {
		TF_HTTP_USERNAME: "terraform"
		TF_HTTP_PASSWORD: schema.#OnePasswordRef & {
			ref: "op://Employee/GitLab Rawkode Academy/access-tokens/project-rawkode-academy-terraform"
		}
		CLOUDFLARE_API_KEY: schema.#OnePasswordRef & {
			ref: "op://Private/w3etxulw37bsqb2rsna5px7y4u/api-tokens/all-access"
		}
		DNSIMPLE_TOKEN: schema.#OnePasswordRef & {
			ref: "op://Private/Dnsimple/api-token"
		}
	}
}

ci: pipelines: [
	{
		name: "pull-request"
		when: pullRequest: true
		tasks: ["plan"]
	},
]

tasks: {
	plan: {
		command: "npx"
		args: ["cdktf", "plan"]
	}
	apply: {
		command: "npx"
		args: ["cdktf", "apply", "--auto-approve"]
	}
}
