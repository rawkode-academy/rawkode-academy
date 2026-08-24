package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-studio-recording-ingest"

let _t = tasks
let _taskPath = "/home/runner/.bun/bin:/Users/rawkode/.bun/bin:/run/current-system/sw/bin:/nix/var/nix/profiles/default/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
let _queueName = "platform-studio-recording-ingest"
let _contentBucket = "rawkode-academy-content"

tasks: [string]: hermetic: false

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
			branch:        ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: [_t.check, _t.test, _t."deploy.dry-run", _t.migrate, _t.deploy]
	}

	pullRequest: {
		when: {
			pullRequest: true
		}
		tasks: [_t.check, _t.test, _t."deploy.dry-run"]
	}
}

tasks: {
	check: schema.#Task & {
		command: "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run check"]
		env: PATH: _taskPath
		inputs: [
			"../../../../bun.lock",
			"data-model/**",
			"package.json",
			"scripts/**",
			"src/**",
			"tests/**",
			"tsconfig.json",
			"wrangler.jsonc",
		]
	}

	test: schema.#Task & {
		command: "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run test"]
		env: PATH: _taskPath
		dependsOn: [_t.check]
		inputs: [
			"../../../../bun.lock",
			"data-model/**",
			"package.json",
			"scripts/**",
			"src/**",
			"tests/**",
			"tsconfig.json",
		]
	}

	deploy: schema.#Task & {
		command: "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun x wrangler deploy --config ./wrangler.jsonc"]
		env: PATH: _taskPath
		dependsOn: [_t.migrate]
		inputs: [
			"../../../../bun.lock",
			"data-model/**",
			"package.json",
			"src/**",
			"wrangler.jsonc",
		]
	}

	"deploy.dry-run": schema.#Task & {
		command: "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run deploy:dry-run"]
		env: PATH: _taskPath
		dependsOn: [_t.test]
		inputs: [
			"../../../../bun.lock",
			"data-model/**",
			"package.json",
			"src/**",
			"wrangler.jsonc",
		]
	}

	migrate: schema.#Task & {
		command: "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun x wrangler d1 migrations apply \(_queueName) --remote"]
		env: PATH: _taskPath
		dependsOn: [_t."deploy.dry-run"]
		inputs: [
			"../../../../bun.lock",
			"data-model/**",
			"package.json",
			"wrangler.jsonc",
		]
	}

	"queues.create": schema.#Task & {
		command: "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun x wrangler queues create \(_queueName) && bun x wrangler queues create \(_queueName)-dlq"]
		env: PATH: _taskPath
	}

	"notify.create": schema.#Task & {
		command: "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun x wrangler r2 bucket notification create \(_contentBucket) --event-type object-create --queue \(_queueName) --prefix \"studio/recordings/\" --suffix \"/ready.json\""]
		env: PATH: _taskPath
	}

	"notify.list": schema.#Task & {
		command: "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun x wrangler r2 bucket notification list \(_contentBucket)"]
		env: PATH: _taskPath
	}
}
