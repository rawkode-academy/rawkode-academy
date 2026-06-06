package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-notifications"

let _t = tasks
let _taskPath = "/home/runner/.bun/bin:/Users/rawkode/.bun/bin:/run/current-system/sw/bin:/nix/var/nix/profiles/default/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
let _queueNames = "rawkode-academy-notifications"

env: {
	SERVICE_NAME: "notifications"

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
			branch:        ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: [_t.check, _t.test, _t.migrate, _t.deploy.main]
	}

	pullRequest: {
		environment: "production"
		when: {
			pullRequest: true
		}
		tasks: [_t.check, _t.test, _t.deploy."dry-run"]
	}
}

tasks: {
	check: schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run check"]
		env: PATH: _taskPath
		inputs: [
			"package.json",
			"src/**",
			"tests/**",
			"tsconfig.json",
			"wrangler.jsonc",
		]
	}

	test: schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run test"]
		env: PATH: _taskPath
		inputs: [
			"package.json",
			"src/**",
			"tests/**",
			"tsconfig.json",
		]
	}

	migrate: schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run migrate"]
		env: PATH: _taskPath
		inputs: [
			"data-model/**",
			"package.json",
			"wrangler.jsonc",
		]
	}

	queues: schema.#TaskGroup & {
		type: "group"
		ensure: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run queues:ensure"]
			env: {
				PATH:                   _taskPath
				CLOUDFLARE_QUEUE_NAMES: _queueNames
			}
			inputs: [
				"package.json",
				"scripts/ensure-queues.ts",
				"wrangler.jsonc",
			]
		}
	}

	deploy: schema.#TaskGroup & {
		type: "group"
		main: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run deploy"]
			env: PATH: _taskPath
			dependsOn: [_t.queues.ensure]
			inputs: [
				"data-model/**",
				"env.cue",
				"package.json",
				"scripts/**",
				"src/**",
				"wrangler.jsonc",
			]
		}

		"dry-run": schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run deploy:dry-run"]
			env: PATH: _taskPath
			inputs: [
				"data-model/**",
				"env.cue",
				"package.json",
				"scripts/**",
				"src/**",
				"wrangler.jsonc",
			]
		}
	}
}
