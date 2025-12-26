package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Base

config: ci: cuenv: source: "release"

env: {
	environment: production: {
		CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce"
		TF_WORKSPACE: "production"
	}
}

workspaces: bun: {}

