package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-website"

runtime: schema.#DevenvRuntime
hooks: onEnter: devenv: schema.#Devenv

let _t = tasks
let _queueNames = "rawkode-academy-notifications"

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

	"sync-realtimekit-webhook": schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "sync:realtimekit-webhook"]

		inputs: [
			"package.json",
			"scripts/sync-realtimekit-webhook.ts",
		]
	}

	queues: schema.#TaskGroup & {
		type: "group"
		ensure: schema.#Task & {
			hermetic: false
			command:  "bun"
			args: ["../platform/notifications/scripts/ensure-queues.ts"]
			env: {
				CLOUDFLARE_QUEUE_NAMES: _queueNames
				WRANGLER_CONFIG:        "./wrangler.jsonc"
			}

			inputs: [
				"../platform/notifications/scripts/ensure-queues.ts",
				"wrangler.jsonc",
			]
		}
	}

	deploy: schema.#TaskGroup & {
		type: "group"
		main: schema.#Task & {
			hermetic: false
			command:  "sh"
			args: [
				"-lc",
				"bun run sync:realtimekit-webhook && bun run build && bun x wrangler deploy --config ./dist/server/wrangler.json",
			]
			dependsOn: [_t.queues.ensure]
			inputs: [
				"astro.config.mts",
				"package.json",
				"public/**",
				"scripts/sync-realtimekit-webhook.ts",
				"src/**",
				"wrangler.jsonc",
			]
		}
		preview: schema.#Task & {
			hermetic: false
			command:  "bun"
			args: ["x", "wrangler", "versions", "upload"]
			dependsOn: [_t.build, _t.queues.ensure]
			inputs: [
				"astro.config.mts",
				"package.json",
				"public/**",
				"scripts/sync-realtimekit-webhook.ts",
				"src/**",
				"wrangler.jsonc",
			]
			captures: previewUrl: {
				pattern: "Version Preview URL: (.+)"
			}
		}
	}
}
