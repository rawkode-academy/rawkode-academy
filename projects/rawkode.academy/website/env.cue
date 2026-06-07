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

tasks: {
	dev: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "dev"]

		inputs: [
			"astro.config.mts",
			"package.json",
			"public/**",
			"src/**",
		]
	}

	build: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "build"]

		inputs: [
			"astro.config.mts",
			"package.json",
			"public/**",
			"src/**",
		]

		outputs: [
			"dist/**",
		]
	}

	deploy: schema.#TaskGroup & {
		type: "group"
		main: schema.#Task & {
			hermetic: false
			command:  "sh"
			args: [
				"-lc",
				"bun run build && bun x wrangler deploy --config ./dist/server/wrangler.json",
			]
			inputs: [
				"astro.config.mts",
				"package.json",
				"public/**",
				"src/**",
				"wrangler.jsonc",
			]
		}
		preview: schema.#Task & {
			hermetic: false
			command:  "bun"
			args: ["x", "wrangler", "versions", "upload"]
			dependsOn: [_t.build]
			inputs: [
				"astro.config.mts",
				"package.json",
				"public/**",
				"src/**",
				"wrangler.jsonc",
			]
			captures: previewUrl: {
				pattern: "Version Preview URL: (.+)"
			}
		}
	}
}
