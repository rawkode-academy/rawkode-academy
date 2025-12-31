package cuenv

import (
	"github.com/cuenv/cuenv/schema"
	xBun "github.com/cuenv/cuenv/contrib/bun"
)

schema.#Base

runtime: schema.#ToolsRuntime & {
	platforms: ["darwin-arm64", "darwin-x86_64", "linux-x86_64", "linux-arm64"]
	tools: {
		bun: xBun.#Bun & {version: "1.3.5"}
	}
}

hooks: onEnter: tools: schema.#ToolsActivate

config: ci: cuenv: source: "release"

env: {
	environment: production: {
		CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce"
		TF_WORKSPACE:          "production"
	}
}

workspaces: bun: {}
