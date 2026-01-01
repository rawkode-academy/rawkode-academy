package cuenv

import (
	"github.com/cuenv/cuenv/schema"
	xBun "github.com/cuenv/cuenv/contrib/bun"
	c "github.com/cuenv/cuenv/contrib/contributors"
)

schema.#Base

runtime: schema.#ToolsRuntime & {
	platforms: ["darwin-arm64", "darwin-x86_64", "linux-x86_64", "linux-arm64"]
	tools: {
		bun: xBun.#Bun & {version: "1.3.5"}
	}
}

hooks: onEnter: tools: schema.#ToolsActivate

ci: contributors: [
	c.#Nix,
	c.#CuenvRelease,
	c.#OnePassword,
]

env: {
	environment: production: {
		CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce"
		TF_WORKSPACE:          "production"
	}
}
