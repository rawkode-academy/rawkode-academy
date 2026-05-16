package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "klustered-live"

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
		command: "deno"
		args: ["task", "dev"]

		inputs: [
			"astro.config.mjs",
			"deno.json",
			"public/**",
			"src/**",
		]
	}

	build: schema.#Task & {
		command: "deno"
		args: ["task", "build"]

		inputs: [
			"astro.config.mjs",
			"deno.json",
			"public/**",
			"src/**",
		]

		outputs: [
			"dist/**",
		]
	}

	check: schema.#Task & {
		command: "deno"
		args: ["task", "check"]

		inputs: [
			"astro.config.mjs",
			"deno.json",
			"src/**",
			"tsconfig.json",
		]
	}

	deploy: schema.#TaskGroup & {
		type: "group"
		main: schema.#Task & {
			command: "deno"
			args: ["run", "-A", "npm:wrangler@^4", "deploy"]
			dependsOn: [_t.build]
		}
		preview: schema.#Task & {
			command: "deno"
			args: ["run", "-A", "npm:wrangler@^4", "versions", "upload"]
			dependsOn: [_t.build]
			captures: previewUrl: {
				pattern: "Version Preview URL: (.+)"
			}
		}
	}
}
