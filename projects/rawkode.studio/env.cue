package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-studio"

runtime: schema.#DevenvRuntime
hooks: onEnter: devenv: schema.#Devenv

let _t = tasks
let _taskPath = "/home/runner/.bun/bin:/Users/rawkode/.bun/bin:/run/current-system/sw/bin:/nix/var/nix/profiles/default/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

env: {
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
		tasks: [_t.check, _t.test, _t.deploy."dry-run", _t.migrations.remote, _t.deploy.main]
	}

	pullRequest: {
		when: {
			pullRequest: true
		}
		tasks: [_t.check, _t.test, _t.deploy."dry-run"]
	}
}

tasks: {
	dev: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "dev"]
		inputs: [
			"../../bun.lock",
			"astro.config.mts",
			"package.json",
			"scripts/**",
			"src/**",
			"wrangler.jsonc",
		]
	}

	build: schema.#Task & {
		hermetic: false
		command:  "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run build"]
		env: PATH: _taskPath
		inputs: [
			"../../bun.lock",
			"astro.config.mts",
			"package.json",
			"src/**",
			"wrangler.jsonc",
		]
		outputs: ["dist/**"]
	}

	check: schema.#Task & {
		hermetic: false
		command:  "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run check"]
		env: PATH: _taskPath
		inputs: [
			"../../bun.lock",
			"astro.config.mts",
			"package.json",
			"src/**",
			"tsconfig.json",
			"wrangler.jsonc",
		]
	}

	test: schema.#Task & {
		hermetic: false
		command:  "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run test"]
		env: PATH: _taskPath
		inputs: [
			"../../bun.lock",
			"data-model/**",
			"package.json",
			"scripts/**",
			"src/**",
			"wrangler.jsonc",
		]
	}

	migrations: schema.#TaskGroup & {
		type: "group"
		remote: schema.#Task & {
			hermetic: false
			command:  "sh"
			args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run migrate"]
			env: PATH: _taskPath
			inputs: [
				"data-model/**",
				"wrangler.jsonc",
			]
		}
	}

	deploy: schema.#TaskGroup & {
		type: "group"
		main: schema.#Task & {
			hermetic: false
			command:  "sh"
			args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run deploy"]
			env: PATH: _taskPath
			dependsOn: [_t.build]
			inputs: [
				"../../bun.lock",
				"astro.config.mts",
				"data-model/**",
				"package.json",
				"src/**",
				"wrangler.jsonc",
			]
		}
		preview: schema.#Task & {
			hermetic: false
			command:  "sh"
			args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun x wrangler versions upload"]
			env: PATH: _taskPath
			dependsOn: [_t.build]
			captures: previewUrl: {
				pattern: "Version Preview URL: (.+)"
			}
		}
		"dry-run": schema.#Task & {
			hermetic: false
			command:  "sh"
			args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run deploy:dry-run"]
			env: PATH: _taskPath
			dependsOn: [_t.build]
			inputs: [
				"../../bun.lock",
				"astro.config.mts",
				"data-model/**",
				"package.json",
				"src/**",
				"wrangler.jsonc",
			]
		}
	}
}
