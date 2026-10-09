package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-website"

runtime: schema.#DevenvRuntime
hooks: onEnter: devenv: schema.#Devenv

let _t = tasks
// CI tasks resolve their tools through Nix directly, the way the platform
// services do, instead of relying on the devenv shell being materialised on
// the runner. The explicit PATH exposes the runner's Nix profile and Bun.
let _taskPath = "/home/runner/.bun/bin:/Users/rawkode/.bun/bin:/run/current-system/sw/bin:/nix/var/nix/profiles/default/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
let _toolchain = "nix shell nixpkgs#bun nixpkgs#nodejs_24 nixpkgs#d2 -c"
// The review frontend (preview.rawkode.academy) is a separate Worker. Its
// tasks share one input set so that only review changes redeploy it.
let _reviewInputs = [
	"review/**",
	"astro.review.config.mts",
	"env.cue",
	"../../../packages/design-system/**",
	"package.json",
	"../../../bun.lock",
	"wrangler.review.jsonc",
	"tsconfig.review.json",
	"src/styles/**",
]
env: {
	GRAPHQL_ENDPOINT: "https://api.rawkode.academy/"
	// Bypass the game login gate in local dev only. Production MUST require
	// login (games read Astro.locals.user); the production override forces it off.
	DISABLE_GAME_AUTH: true
	environment: production: {
		DISABLE_GAME_AUTH: false
	}
}

ci: pipelines: {
	default: {
		environment: "production"
		when: {
			branch: ["main"]
			defaultBranch: true
			// deploy.awaitPayload reads this input from the dispatch event, so an
			// operator can redeploy the review frontend once Payload is confirmed
			// live without waiting for a tag that will never appear.
			manual: skip_payload_wait: {
				description: "Deploy the review frontend without waiting for the Payload deploy of this commit"
				type:        "boolean"
				default:     "false"
			}
		}
		// cuenv runs pipeline entries in order and does not stop at a failed
		// entry, so the public site deploys first and a review frontend failure
		// only marks the run as failed.
		tasks: [_t.deploy.main, _t.deploy.review]
	}

	pullRequest: {
		environment: "production"
		when: {
			pullRequest: true
		}
		tasks: [_t.deploy.preview, _t.review.test, _t.review.build]
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
			"../../../bun.lock",
			"scripts/**",
			"vitest.config.ts",
			"public/**",
			"src/**",
		]
	}

	build: schema.#Task & {
		hermetic: false
		command:  "sh"
		args: ["-lc", "\(_toolchain) bun run build"]
		env: PATH: _taskPath

		// env.cue is included so build-time env changes (e.g. DISABLE_GAME_AUTH)
		// mark the build/deploy affected; otherwise CI would skip the redeploy.
		inputs: [
			// CI change detection compares repo-relative paths; retain the
			// definition-relative glob below for local/task input resolution.
			"content/**",
			"../../../content/**",
			"astro.config.mts",
			"env.cue",
			"../../../packages/design-system/**",
			"package.json",
			"../../../bun.lock",
			"scripts/**",
			"vitest.config.ts",
			"public/**",
			"src/**",
			"wrangler.jsonc",
		]

		outputs: [
			"dist/**",
		]
	}

	review: schema.#TaskGroup & {
		type: "group"
		test: schema.#Task & {
			hermetic: false
			command:  "sh"
			args: ["-lc", "\(_toolchain) bun run review:test"]
			env: PATH: _taskPath
			inputs: [
				"review/**",
				"vitest.review.config.ts",
				"tsconfig.review.json",
				"package.json",
				"../../../bun.lock",
			]
		}
		build: schema.#Task & {
			hermetic: false
			command:  "sh"
			args: ["-lc", "\(_toolchain) bun run review:build"]
			env: PATH: _taskPath
			inputs: _reviewInputs
			outputs: ["dist-review/**"]
		}
	}

	deploy: schema.#TaskGroup & {
		type: "group"
		main: schema.#Task & {
			hermetic: false
			command:  "sh"
			args: [
				"-lc",
				"\(_toolchain) sh -c 'bun run build && bun x wrangler deploy --config ./dist/server/wrangler.json'",
			]
			env: PATH: _taskPath
			// env.cue drives build-time vars (e.g. DISABLE_GAME_AUTH); include it so
			// an env-only change marks this deploy affected (else CI skips it).
			inputs: [
				// CI change detection compares repo-relative paths; retain the
				// definition-relative glob below for local/task input resolution.
				"content/**",
				"../../../content/**",
				"astro.config.mts",
				"env.cue",
				"../../../packages/design-system/**",
				"package.json",
				"../../../bun.lock",
				"scripts/**",
				"vitest.config.ts",
				"public/**",
				"src/**",
				"wrangler.jsonc",
			]
		}
		// Waits until rawkode-academy-payload serves this commit (by tag) or a
		// newer commit that contains it, but only when the push matches the push
		// paths of the generated Payload workflow. A cross-project dependsOn would
		// run Payload's deploy from this job, so the ordering is enforced by
		// polling the deployed Worker instead. Both workflows cancel in-progress
		// runs: if a newer push cancels this run while it waits and that push does
		// not touch review inputs, the review frontend for this commit is not
		// deployed until the next review change or a manual run.
		awaitPayload: schema.#Task & {
			hermetic: false
			command:  "sh"
			args: ["-lc", "\(_toolchain) bun review/deploy/await-payload-cli.ts"]
			env: {
				PATH:                        _taskPath
				GITHUB_EVENT_PATH:           schema.#EnvPassthrough
				REVIEW_SKIP_PAYLOAD_WAIT:    schema.#EnvPassthrough
				REVIEW_PAYLOAD_WAIT_SECONDS: schema.#EnvPassthrough
			}
			inputs: _reviewInputs
		}
		review: schema.#Task & {
			hermetic: false
			command:  "sh"
			args: ["-lc", "\(_toolchain) bun x wrangler deploy --config ./dist-review/server/wrangler.json"]
			env: PATH: _taskPath
			dependsOn: [_t.review.test, _t.review.build, _t.deploy.awaitPayload]
			inputs: _reviewInputs
		}
		preview: schema.#Task & {
			hermetic: false
			command:  "sh"
			args: ["-lc", "\(_toolchain) bun x wrangler versions upload"]
			env: PATH: _taskPath
			dependsOn: [_t.build]
			// A pull-request preview is the pipeline's deliverable, so it must run
			// whenever this pipeline is invoked. The build remains its dependency.
			captures: previewUrl: {
				pattern: "Version Preview URL: (.+)"
			}
		}
	}
}
