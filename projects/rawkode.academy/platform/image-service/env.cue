package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-image-service"

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
			branch:        ["main"]
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
		args: ["x", "wrangler", "dev"]
	}

	build: schema.#Task & {
		command: "bun"
		args: ["run", "build"]
		inputs: [
			"astro.config.ts",
			"package.json",
			"src/**",
			"wrangler.jsonc",
		]
		outputs: ["dist/**"]
	}

	test: schema.#Task & {
		command: "bun"
		args: ["run", "test"]
		inputs: [
			"package.json",
			"src/**",
			"vitest.config.ts",
		]
	}

	deploy: schema.#TaskGroup & {
		type: "group"
		main: schema.#Task & {
			command: "bun"
			args: ["x", "wrangler", "deploy", "--config", "./dist/server/wrangler.json"]
			dependsOn: [_t.test, _t.build]
			inputs: [
				"astro.config.ts",
				"package.json",
				"src/**",
				"wrangler.jsonc",
			]
		}
		preview: schema.#Task & {
			command: "bun"
			args: ["x", "wrangler", "versions", "upload", "--config", "./dist/server/wrangler.json"]
			dependsOn: [_t.test, _t.build]
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
