package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-studio"

runtime: schema.#DevenvRuntime
hooks: onEnter: devenv: schema.#Devenv

let _t = tasks

environment: {
	CLOUDFLARE_ACCOUNT_ID: schema.#OnePasswordRef & {
		ref: "op://sa.rawkode.academy/rawkode-studio/cloudflare-account-id"
	}
		CLOUDFLARE_STREAM_API_TOKEN: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/rawkode-studio/cloudflare-stream-api-token"
		}
		CLOUDFLARE_REALTIME_APP_ID: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/rawkode-studio/cloudflare-realtime-app-id"
		}
		CLOUDFLARE_REALTIME_APP_SECRET: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/rawkode-studio/cloudflare-realtime-app-secret"
		}
		YOUTUBE_RTMP_URL: "rtmp://a.rtmp.youtube.com/live2"
		YOUTUBE_STREAM_KEY: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/rawkode-studio/youtube-stream-key"
	}
	TWITCH_RTMP_URL: "rtmp://live.twitch.tv/app"
	TWITCH_STREAM_KEY: schema.#OnePasswordRef & {
		ref: "op://sa.rawkode.academy/rawkode-studio/twitch-stream-key"
	}
	LINKEDIN_RTMP_URL: schema.#OnePasswordRef & {
		ref: "op://sa.rawkode.academy/rawkode-studio/linkedin-rtmp-url"
	}
	LINKEDIN_STREAM_KEY: schema.#OnePasswordRef & {
		ref: "op://sa.rawkode.academy/rawkode-studio/linkedin-stream-key"
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
		tasks: [_t.deploy.main]
	}

	pullRequest: {
		environment: "production"
		when: {
			pullRequest: true
		}
		tasks: [_t.deploy.preview]
	}
}

tasks: {
	dev: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "dev"]
		inputs: [
			"astro.config.ts",
			"package.json",
			"public/**",
			"src/**",
			"wrangler.jsonc",
		]
	}

	build: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "build"]
		inputs: [
			"astro.config.ts",
			"package.json",
			"public/**",
			"src/**",
			"wrangler.jsonc",
		]
		outputs: ["dist/**"]
	}

	test: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "test"]
		inputs: [
			"src/**",
			"package.json",
			"vitest.config.ts",
		]
	}

	deploy: schema.#TaskGroup & {
		type: "group"
		main: schema.#Task & {
			hermetic: false
			command:  "bun"
			args: ["x", "wrangler", "deploy"]
			dependsOn: [_t.build]
		}
		preview: schema.#Task & {
			hermetic: false
			command:  "bun"
			args: ["x", "wrangler", "versions", "upload"]
			dependsOn: [_t.build]
		}
	}
}
