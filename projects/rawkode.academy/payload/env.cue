package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-payload"

runtime: schema.#DevenvRuntime
hooks: onEnter: devenv: schema.#Devenv

let _t = tasks
let _taskPath = "/home/runner/.bun/bin:/Users/rawkode/.bun/bin:/run/current-system/sw/bin:/nix/var/nix/profiles/default/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
let _toolchain = "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c"

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
			manual: true
		}
		tasks: [_t.check, _t.test, _t.build]
	}

	pullRequest: {
		environment: "production"
		when: pullRequest: true
		tasks: [_t.check, _t.test, _t.build, _t.deploy.preview]
		annotations: "Preview URL": schema.#TaskCaptureRef & {
			cuenvTask: "deploy.preview"
			cuenvCapture: "previewUrl"
		}
	}
}

tasks: {
	check: schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "\(_toolchain) bun run typecheck"]
		env: PATH: _taskPath
		inputs: [
			"app/**",
			"src/**",
			"scripts/**",
			"payload.config.ts",
			"worker.ts",
			"package.json",
			"tsconfig.json",
			"../../../bun.lock",
		]
	}

	test: schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "\(_toolchain) bun run test"]
		env: PATH: _taskPath
		inputs: [
			"src/**",
			"tests/**",
			"fixtures/**",
			"package.json",
			"../../../bun.lock",
		]
	}

	build: schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "\(_toolchain) bun run setup && bun run build:worker"]
		env: PATH: _taskPath
		inputs: [
			"app/**",
			"src/**",
			"scripts/**",
			"fixtures/**",
			"payload.config.ts",
			"worker.ts",
			"open-next.config.ts",
			"next.config.mjs",
			"package.json",
			"wrangler.jsonc",
			"tsconfig.json",
			"../../../bun.lock",
		]
		outputs: [".open-next/**"]
	}

	deploy: schema.#TaskGroup & {
		type: "group"
		preview: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "\(_toolchain) bun run migrate:preview && bun run deploy:preview"]
			env: PATH: _taskPath
			dependsOn: [_t.build]
			captures: previewUrl: {
				pattern: "Preview URL: (.+)"
			}
		}
	}
}
