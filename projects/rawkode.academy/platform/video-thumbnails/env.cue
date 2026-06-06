package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-video-thumbnails"

let _t = tasks
let _taskPath = "/home/runner/.bun/bin:/Users/rawkode/.bun/bin:/run/current-system/sw/bin:/nix/var/nix/profiles/default/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

env: {
	SERVICE_NAME: "video-thumbnails"

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
		tasks: [_t.check, _t.test, _t.deploy.main, _t."schedule-missing"]
	}

	pullRequest: {
		environment: "production"
		when: {
			pullRequest: true
		}
		tasks: [_t.check, _t.test, _t.deploy."dry-run"]
	}

	"regenerate-iroh-odin": {
		environment: "production"
		when: {
			branch: ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: [_t."regenerate-iroh-odin"]
	}
}

tasks: {
	check: schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run check"]
		env: PATH: _taskPath
		inputs: [
			"package.json",
			"scripts/**",
			"src/**",
			"tests/**",
			"tsconfig.json",
			"wrangler.jsonc",
			"../../../../content/people/**",
			"../../../../content/technologies/**",
			"../../../../content/videos/**",
		]
	}

	test: schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run test"]
		env: PATH: _taskPath
		inputs: [
			"package.json",
			"scripts/**",
			"src/**",
			"tests/**",
			"tsconfig.json",
			"../../../../content/people/**",
			"../../../../content/technologies/**",
			"../../../../content/videos/**",
		]
	}

	deploy: schema.#TaskGroup & {
		type: "group"
		main: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run deploy"]
			env: PATH: _taskPath
			inputs: [
				"env.cue",
				"package.json",
				"src/**",
				"wrangler.jsonc",
			]
		}

		"dry-run": schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run deploy:dry-run"]
			env: PATH: _taskPath
			inputs: [
				"env.cue",
				"package.json",
				"src/**",
				"wrangler.jsonc",
			]
		}
	}

	"check-missing": schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun run trigger:missing:dry-run"]
		env: PATH: _taskPath
		inputs: [
			"env.cue",
			"package.json",
			"scripts/**",
			"src/**",
			"wrangler.jsonc",
			"../../../../content/people/**",
			"../../../../content/technologies/**",
			"../../../../content/videos/**",
		]
	}

	"schedule-missing": schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun scripts/trigger_missing.ts --force-changed-content"]
		env: PATH: _taskPath
		inputs: [
			"env.cue",
			"package.json",
			"scripts/**",
			"src/**",
			"wrangler.jsonc",
			"../../../../content/people/**",
			"../../../../content/technologies/**",
			"../../../../content/videos/**",
		]
	}

	"regenerate-iroh-odin": schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c bun scripts/trigger_missing.ts --force --video-id 7564ecf9c5c00c7ceea52daf --video-id 7f1dfedcbf38a19375306862"]
		env: PATH: _taskPath
		inputs: [
			"env.cue",
			"package.json",
			"scripts/**",
			"src/**",
			"wrangler.jsonc",
			"../../../../content/people/**",
			"../../../../content/technologies/**",
			"../../../../content/videos/**",
		]
	}
}
