package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "klustered-dev"

runtime: schema.#DevenvRuntime
hooks: onEnter: devenv: schema.#Devenv

let _t = tasks

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
		command: "bun"
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
		command: "bun"
		args: ["run", "build"]

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
		command: "bun"
		args: ["run", "check"]

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
			command: "bun"
			args: ["x", "wrangler", "deploy"]
			dependsOn: [_t.build]
		}
		preview: schema.#Task & {
			command: "bun"
			args: ["x", "wrangler", "versions", "upload"]
			dependsOn: [_t.build]
			captures: previewUrl: {
				pattern: "Version Preview URL: (.+)"
			}
		}
	}
}
