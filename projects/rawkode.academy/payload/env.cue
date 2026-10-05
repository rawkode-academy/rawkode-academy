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
		// The shared Workers token currently cannot provision Containers. Pull
		// requests still get an isolated auth/D1/R2 preview while media remains
		// fail-closed; remove this once the token has Containers:Edit.
		CLOUDFLARE_PREVIEW_ALLOW_DEGRADED_CONTAINERS: "true"
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
		tasks: [_t.check, _t.test, _t.deploy.main]
	}

	pullRequest: {
		environment: "production"
		when: pullRequest: true
		tasks: [_t.deploy.preview]
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
			"src/migrations/**",
			"tests/**",
			"fixtures/**",
			"evidence/**",
			"package.json",
			"../../../bun.lock",
		]
	}

	setup: schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "\(_toolchain) bun run setup"]
		env: PATH: _taskPath
		inputs: ["scripts/setup.mjs", "package.json"]
	}

	build: schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "\(_toolchain) bun run build:worker"]
		env: PATH: _taskPath
		dependsOn: [_t.setup]
		inputs: [
			"app/**",
			"src/**",
			"src/migrations/**",
			"scripts/**",
			"fixtures/**",
			"evidence/**",
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
		migrate: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "\(_toolchain) bun run migrate:remote"]
			env: PATH: _taskPath
			dependsOn: [_t.setup]
			inputs: [
				"src/migrations/**",
				"src/**",
				"payload.config.ts",
				"scripts/setup.mjs",
				"package.json",
				"wrangler.jsonc",
				"../../../bun.lock",
			]
		}

		migratePreview: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "\(_toolchain) bun run migrate:preview"]
			env: PATH: _taskPath
			dependsOn: [_t.build]
		}

		main: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "\(_toolchain) bun x wrangler deploy"]
			env: PATH: _taskPath
			dependsOn: [_t.build, _t.deploy.migrate]
			inputs: [
				"app/**",
				"src/**",
				"src/migrations/**",
				"scripts/**",
				"payload.config.ts",
				"worker.ts",
				"open-next.config.ts",
				"next.config.mjs",
				"package.json",
				"wrangler.jsonc",
				"tsconfig.json",
				"../../../bun.lock",
			]
		}

		preview: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "\(_toolchain) bun run deploy:preview"]
			env: PATH: _taskPath
			dependsOn: [_t.check, _t.test, _t.deploy.migratePreview]
			captures: previewUrl: {
				pattern: "Preview URL: (.+)"
			}
		}
	}
}
