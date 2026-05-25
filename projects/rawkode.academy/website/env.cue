package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-website"

runtime: schema.#DevenvRuntime
hooks: onEnter: devenv: schema.#Devenv

let _t = tasks

env: {
	GRAPHQL_ENDPOINT:  "https://api.rawkode.academy/"
	DISABLE_GAME_AUTH: true
}

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

let _runtimeInputs = [
	"astro.config.mts",
	"deno.json",
	"package.json",
	"public/**",
	"src/**",
]

let _qualityInputs = [
	"astro.config.mts",
	"deno.json",
	"graphql-codegen.ts",
	"package.json",
	"scripts/**",
	"src/**",
]

tasks: {
	dev: schema.#Task & {
		hermetic: false
		command:  "deno"
		args: ["task", "dev"]

		inputs: _runtimeInputs
	}

	build: schema.#Task & {
		hermetic: false
		command:  "deno"
		args: ["task", "build"]

		inputs: _runtimeInputs

		outputs: [
			"dist/**",
		]
	}

	quality: schema.#TaskGroup & {
		type: "group"
		format: schema.#Task & {
			hermetic: false
			command:  "deno"
			args: ["task", "format:check"]
			inputs: _qualityInputs
		}
		denoLint: schema.#Task & {
			hermetic: false
			command:  "deno"
			args: ["task", "lint:deno"]
			inputs: _qualityInputs
		}
		oxlint: schema.#Task & {
			hermetic: false
			command:  "deno"
			args: ["task", "lint:oxlint"]
			inputs: _qualityInputs
		}
		fallow: schema.#Task & {
			hermetic: false
			command:  "deno"
			args: ["task", "lint:fallow"]
			inputs: _qualityInputs
		}
	}

	test: schema.#Task & {
		hermetic: false
		command:  "deno"
		args: ["task", "test"]
		inputs: [
			"deno.json",
			"package.json",
			"src/**",
			"vitest.config.*",
		]
	}

	deploy: schema.#TaskGroup & {
		type: "group"
		main: schema.#Task & {
			hermetic: false
			command:  "deno"
			args: ["task", "wrangler:deploy"]
			dependsOn: [_t.build]
		}
		preview: schema.#Task & {
			hermetic: false
			command:  "deno"
			args: ["task", "wrangler:preview"]
			dependsOn: [_t.build]
			captures: previewUrl: {
				pattern: "Version Preview URL: (.+)"
			}
		}
	}
}
