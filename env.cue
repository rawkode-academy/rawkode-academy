package cuenv

import (
	"github.com/cuenv/cuenv/schema"
	c "github.com/cuenv/cuenv/contrib/contributors"
)

schema.#Base

runtime: schema.#DevenvRuntime

hooks: onEnter: devenv: schema.#Devenv

ci: providers: ["github"]
ci: contributors: [
	c.#Nix,
	c.#BunWorkspace,
	c.#CuenvRelease,
	c.#OnePassword,
]

env: {
	environment: production: {
		CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce"
		TF_WORKSPACE:          "production"
	}
}
