package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-badge-service"

let _t = tasks
let _taskPath = "/home/runner/.bun/bin:/Users/rawkode/.bun/bin:/run/current-system/sw/bin:/nix/var/nix/profiles/default/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

env: {
	SERVICE_NAME: "badge-service"

	environment: production: {
		CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/cloudflare/api-tokens/workers"
		}
	}
}

ci: _service.ci & {
	pipelines: pullRequest: {
		environment: "production"
		when: {
			pullRequest: true
		}
		tasks: [_t.check, _t.test, _t.config.check, _t.deploy."dry-run"]
	}
}

tasks: _service.tasks & {
	check: schema.#Task & {
		hermetic: false
		command:  "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun x tsc --noEmit -p tsconfig.json --types @cloudflare/workers-types"]
		env: PATH: _taskPath
		inputs: [
			"data-model/**",
			"http/**",
			"lib/**",
			"package.json",
			"tsconfig.json",
		]
	}

	test: schema.#Task & {
		hermetic: false
		command:  "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun test lib/openbadges/__tests__/openbadges.test.ts http/__tests__/schemas.test.ts"]
		env: PATH: _taskPath
		inputs: [
			"http/**",
			"lib/**",
			"package.json",
		]
	}

	config: schema.#TaskGroup & {
		type: "group"
		check: schema.#Task & {
			hermetic: false
			command:  "sh"
			args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun scripts/check-generated-config.ts"]
			env: PATH: _taskPath
			inputs: [
				"http/wrangler.jsonc",
				"scripts/check-generated-config.ts",
			]
		}
	}

	deploy: schema.#TaskGroup & {
		type: "group"
		"dry-run": schema.#Task & {
			hermetic: false
			command:  "sh"
			args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun x wrangler deploy --dry-run --config ./http/wrangler.jsonc"]
			env: PATH: _taskPath
			inputs: [
				"data-model/**",
				"env.cue",
				"http/**",
				"lib/**",
				"package.json",
				"service.cue",
			]
		}
	}
}
codegen: _service.codegen
