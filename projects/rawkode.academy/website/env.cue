package cuenv

import (
	"list"

	"github.com/cuenv/cuenv/schema"
)

schema.#Project

name: "rawkode-academy-website"

runtime: schema.#DevenvRuntime
hooks: onEnter: devenv: schema.#Devenv

let _t = tasks
let _denoTaskArgs = ["shell", "nixpkgs#deno", "-c", "deno", "task"]

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
		tasks: [
			_t.quality.format,
			_t.quality.denoLint,
			_t.quality.oxlint,
			_t.quality.fallow,
			_t.deploy.main,
		]
	}

	pullRequest: {
		environment: "production"
		when: {
			pullRequest: true
		}
		tasks: [
			_t.quality.format,
			_t.quality.denoLint,
			_t.quality.oxlint,
			_t.quality.fallow,
			_t.deploy.preview,
		]
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
	".fallowrc.json",
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
		command:  "nix"
		args: list.Concat([_denoTaskArgs, ["dev"]])

		inputs: _runtimeInputs
	}

	build: schema.#Task & {
		hermetic: false
		command:  "nix"
		args: list.Concat([_denoTaskArgs, ["build"]])

		inputs: _runtimeInputs

		outputs: [
			"dist/**",
		]
	}

	quality: schema.#TaskGroup & {
		type: "group"
		format: schema.#Task & {
			hermetic: false
			command:  "nix"
			args: list.Concat([_denoTaskArgs, ["format:check"]])
			inputs: _qualityInputs
		}
		denoLint: schema.#Task & {
			hermetic: false
			command:  "nix"
			args: list.Concat([_denoTaskArgs, ["lint:deno"]])
			inputs: _qualityInputs
		}
		oxlint: schema.#Task & {
			hermetic: false
			command:  "nix"
			args: list.Concat([_denoTaskArgs, ["lint:oxlint"]])
			inputs: _qualityInputs
		}
		fallow: schema.#Task & {
			hermetic: false
			command:  "nix"
			args: list.Concat([_denoTaskArgs, ["lint:fallow"]])
			inputs: _qualityInputs
		}
	}

	test: schema.#Task & {
		hermetic: false
		command:  "nix"
		args: list.Concat([_denoTaskArgs, ["test"]])
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
			command:  "nix"
			args: list.Concat([_denoTaskArgs, ["wrangler:deploy"]])
			dependsOn: [
				_t.build,
				_t.quality.format,
				_t.quality.denoLint,
				_t.quality.oxlint,
				_t.quality.fallow,
			]
		}
		preview: schema.#Task & {
			hermetic: false
			command:  "nix"
			args: list.Concat([_denoTaskArgs, ["wrangler:preview"]])
			dependsOn: [
				_t.build,
				_t.quality.format,
				_t.quality.denoLint,
				_t.quality.oxlint,
				_t.quality.fallow,
			]
			captures: previewUrl: {
				pattern: "Version Preview URL: (.+)"
			}
		}
	}
}
