package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "klustered-dev"

runtime: schema.#DevenvRuntime
hooks: onEnter: devenv: schema.#Devenv

let _t = tasks
// CI tasks resolve their tools through Nix directly, the way the platform
// services do, instead of relying on the devenv shell being materialised on
// the runner. The explicit PATH exposes the runner's Nix profile and Bun.
let _taskPath = "/home/runner/.bun/bin:/Users/rawkode/.bun/bin:/run/current-system/sw/bin:/nix/var/nix/profiles/default/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
let _toolchain = "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c"

ci: pipelines: {
	default: {
		environment: "production"
		when: {
			branch: ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: [_t.deploy.main]
	}

	pullRequest: {
		environment: "production"
		when: {
			pullRequest: true
		}
		tasks: [_t.deploy.preview]
		annotations: "Preview URL": schema.#TaskCaptureRef & {
			cuenvTask:    "deploy.preview"
			cuenvCapture: "previewUrl"
		}
	}
}

tasks: {
	dev: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "dev"]

		inputs: [
			"astro.config.mjs",
			"package.json",
			"public/**",
			"src/**",
			"wrangler.jsonc",
		]
	}

	build: schema.#Task & {
		hermetic: false
		command:  "sh"
		args: ["-lc", "\(_toolchain) bun run build"]
		env: PATH: _taskPath

		inputs: [
			"astro.config.mjs",
			"package.json",
			"public/**",
			"src/**",
			"wrangler.jsonc",
		]

		outputs: [
			"dist/**",
		]
	}

	check: schema.#Task & {
		hermetic: false
		command:  "sh"
		args: ["-lc", "\(_toolchain) bun run check"]
		env: PATH: _taskPath

		inputs: [
			"astro.config.mjs",
			"package.json",
			"src/**",
			"tsconfig.json",
		]
	}

	deploy: schema.#TaskGroup & {
		type: "group"
		main: schema.#Task & {
			hermetic: false
			command:  "sh"
			args: ["-lc", "\(_toolchain) bun x wrangler deploy"]
			env: PATH: _taskPath
			dependsOn: [_t.build]
		}
		preview: schema.#Task & {
			hermetic: false
			command:  "sh"
			args: ["-lc", "\(_toolchain) bun x wrangler versions upload"]
			env: PATH: _taskPath
			dependsOn: [_t.build]
			captures: previewUrl: {
				pattern: "Version Preview URL: (.+)"
			}
		}
	}
}
