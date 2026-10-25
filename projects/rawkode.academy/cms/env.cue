package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-cms"

let _t = tasks
let _taskPath = "/home/runner/.bun/bin:/run/current-system/sw/bin:/nix/var/nix/profiles/default/bin:/usr/local/bin:/usr/bin:/bin"
let _toolchain = "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c"
let _wrangler = "\(_toolchain) env CLOUDFLARE_API_TOKEN=\"$CLOUDFLARE_API_TOKEN\" CLOUDFLARE_ACCOUNT_ID=\"$CLOUDFLARE_ACCOUNT_ID\" bun x wrangler"

env: {
	CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce"
	environment: production: {
		CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/cloudflare/api-tokens/workers"
		}
	}
}

ci: pipelines: {
	default: {
		environment: "production"
		when: {
			branch: ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: [_t.deploy]
	}
}

let _inputs = [
	"astro.config.mts",
	"env.cue",
	"package.json",
	"wrangler.jsonc",
	"migrations/**",
	"public/**",
	"src/**",
	"../../../bun.lock",
	"../../../packages/content-write/**",
	"../../../packages/content-model/**",
	"../../../packages/rich-text/**",
]

tasks: {
	dev: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "dev"]
	}

	test: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["test"]
		inputs: _inputs
	}

	// Applies the CMS's own D1 migrations, builds and deploys the worker.
	deploy: schema.#Task & {
		hermetic: false
		command:  "sh"
		args: ["-lc", "\(_wrangler) d1 migrations apply DB --remote && \(_toolchain) bun run build && \(_wrangler) deploy --config ./dist/server/wrangler.json"]
		env: PATH: _taskPath
		inputs: _inputs
	}
}
