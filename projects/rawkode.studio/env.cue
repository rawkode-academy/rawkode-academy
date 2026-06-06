package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-studio"

runtime: schema.#DevenvRuntime
hooks: onEnter: devenv: schema.#Devenv

let _t = tasks

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
		tasks: [_t.migrations.remote, _t.check, _t.test, _t.deploy.main]
	}

	pullRequest: {
		environment: "production"
		when: {
			pullRequest: true
		}
		tasks: [_t.check, _t.test, _t.deploy.preview]
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
			"astro.config.mts",
			"package.json",
			"src/**",
			"wrangler.jsonc",
		]
	}

	build: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "build"]
		inputs: [
			"astro.config.mts",
			"package.json",
			"src/**",
			"wrangler.jsonc",
		]
		outputs: ["dist/**"]
	}

	check: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "check"]
		inputs: [
			"astro.config.mts",
			"package.json",
			"src/**",
			"tsconfig.json",
			"wrangler.jsonc",
		]
	}

	test: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "test"]
		inputs: [
			"data-model/**",
			"package.json",
			"src/**",
			"wrangler.jsonc",
		]
	}

	migrations: schema.#TaskGroup & {
		type: "group"
		remote: schema.#Task & {
			hermetic: false
			command:  "bun"
			args: ["run", "migrate"]
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
			command:  "bun"
			args: ["run", "deploy"]
			dependsOn: [_t.build]
			inputs: [
				"astro.config.mts",
				"data-model/**",
				"package.json",
				"src/**",
				"wrangler.jsonc",
			]
		}
		preview: schema.#Task & {
			hermetic: false
			command:  "bun"
			args: ["x", "wrangler", "versions", "upload"]
			dependsOn: [_t.build]
			captures: previewUrl: {
				pattern: "Version Preview URL: (.+)"
			}
		}
	}
}
