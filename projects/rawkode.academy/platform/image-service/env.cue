package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-image-service"

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
			branch:        ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: [_t.test, _t.build, _t.deploy.main]
	}

	pullRequest: {
		environment: "production"
		when: {
			pullRequest: true
		}
		tasks: [_t.test, _t.build, _t.deploy.preview]
		annotations: "Preview URL": schema.#TaskCaptureRef & {
			cuenvTask:    "deploy.preview"
			cuenvCapture: "previewUrl"
		}
	}
}

tasks: {
	dev: schema.#Task & {
		command: "bun"
		args: ["x", "wrangler", "dev"]
	}

	build: schema.#Task & {
		command: "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run build"]
		env: PATH: _taskPath
		inputs: [
			"astro.config.ts",
			"package.json",
			"src/**",
			"wrangler.jsonc",
		]
		outputs: ["dist/**"]
	}

	test: schema.#Task & {
		command: "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run test"]
		env: PATH: _taskPath
		inputs: [
			"package.json",
			"src/**",
			"vitest.config.ts",
		]
	}

	deploy: schema.#TaskGroup & {
		type: "group"
		main: schema.#Task & {
			command: "sh"
			args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun x wrangler deploy --config ./dist/server/wrangler.json"]
			env: PATH: _taskPath
			inputs: [
				"astro.config.ts",
				"package.json",
				"src/**",
				"wrangler.jsonc",
			]
		}
		preview: schema.#Task & {
			command: "sh"
			args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun x wrangler versions upload --config ./dist/server/wrangler.json"]
			env: PATH: _taskPath
			inputs: [
				"astro.config.ts",
				"package.json",
				"src/**",
				"wrangler.jsonc",
			]
			captures: previewUrl: {
				pattern: "Version Preview URL: (.+)"
			}
		}
	}
}
