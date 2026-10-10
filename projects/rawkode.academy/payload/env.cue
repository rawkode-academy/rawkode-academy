package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-payload"

// cuenv 0.55.x gives each env.cue evaluation 10 seconds and silently drops a
// project that exceeds it ("Found 38 projects", exit 0, nothing deployed).
// This project's task graph evaluates close to that limit on CI runners, so its
// workflows use 0.56.1, whose limit is 60 seconds (CUENV_EVAL_TIMEOUT).
_cuenvBinary: "0.56.1"

// 0.56.1 still skips a project whose env.cue fails to evaluate for any other
// reason and still exits 0. The root env.cue turns that into a failed run by
// requiring the pipeline report `cuenv ci` writes for this path.
_ciRequireReport: "projects/rawkode.academy/payload"

runtime: schema.#DevenvRuntime
hooks: onEnter: devenv: schema.#Devenv

let _t = tasks
let _taskPath = "/home/runner/.bun/bin:/Users/rawkode/.bun/bin:/run/current-system/sw/bin:/nix/var/nix/profiles/default/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
let _toolchain = "nix shell nixpkgs#bun nixpkgs#nodejs_24 -c"

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
			branch: ["main"]
			defaultBranch: true
			manual: true
		}
		// cuenv runs these entries in order, does not stop at a failed entry, and
		// re-runs shared dependencies for every entry. deploy.reviewRuntime is
		// therefore the only deploy entry: it depends on deploy.main, so one DAG
		// walk deploys production first and the preview runtime only afterwards.
		tasks: [_t.check, _t.test, _t.deploy.reviewRuntime]
	}

	pullRequest: {
		environment: "production"
		when: pullRequest: true
		tasks: [_t.deploy.preview]
	}
}

tasks: {
	check: schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "\(_toolchain) bun run typecheck"]
		env: PATH: _taskPath
		inputs: [
			"app/**",
			"src/**",
			"scripts/**",
			"payload.config.ts",
			"worker.ts",
			"cloudflare-env.d.ts",
			"next-env.d.ts",
			"package.json",
			"tsconfig.json",
			"../../../bun.lock",
		]
	}

	test: schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "\(_toolchain) bun run test"]
		env: PATH: _taskPath
		inputs: [
			"src/**",
			"src/migrations/**",
			"src/migrations-cuid2/**",
			"scripts/**",
			"tests/**",
			"fixtures/**",
			"evidence/**",
			"wrangler.jsonc",
			"package.json",
			"../../../bun.lock",
		]
	}

	setup: schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "\(_toolchain) bun run setup"]
		env: PATH: _taskPath
		inputs: ["scripts/setup.mjs", "package.json"]
	}

	build: schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "\(_toolchain) bun run build:worker"]
		env: PATH: _taskPath
		dependsOn: [_t.setup]
		inputs: [
			"app/**",
			"src/**",
			"src/migrations/**",
			"scripts/**",
			// build:worker validates the review container recipe, and wrangler.jsonc
			// builds the ReviewFFmpegContainer image from ./container/Dockerfile.
			"container/**",
			"fixtures/**",
			"evidence/**",
			"payload.config.ts",
			"worker.ts",
			"open-next.config.ts",
			"next.config.mjs",
			"package.json",
			"wrangler.jsonc",
			"tsconfig.json",
			"../../../bun.lock",
		]
		outputs: [".open-next/**"]
	}

	// Content cutover (workstream G). Operator-run only: none of these tasks is
	// listed in a CI pipeline. Rehearsal needs REHEARSAL_D1_ID and
	// REHEARSAL_R2_BUCKET for a disposable D1/R2 pair. Production needs
	// CONFIRM_PRODUCTION_IMPORT=rawkode-academy-payload, STATIC_CONTENT_SEQUENCE
	// and a clean checkout; run with `cuenv task -e production <task>`.
	// Klustered only has a rehearsal task: the first production window imports
	// static content only.
	migrate: schema.#TaskGroup & {
		type: "group"
		rehearsal: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "\(_toolchain) bun run migrate:rehearsal"]
			env: PATH: _taskPath
			dependsOn: [_t.setup]
		}
		status: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "\(_toolchain) bun run migrate:status -- --target=production"]
			env: PATH: _taskPath
			dependsOn: [_t.setup]
		}
	}

	"import": schema.#TaskGroup & {
		type: "group"
		rehearsal: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "\(_toolchain) bun run import:static -- --target=rehearsal"]
			env: PATH: _taskPath
			dependsOn: [_t.migrate.rehearsal]
		}
		productionDryRun: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "\(_toolchain) bun run import:static -- --target=production --dry-run"]
			env: PATH: _taskPath
			dependsOn: [_t.migrate.status]
		}
		production: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "\(_toolchain) bun run import:static -- --target=production"]
			env: PATH: _taskPath
			dependsOn: [_t.migrate.status]
		}
		klusteredRehearsal: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "\(_toolchain) bun run import:klustered -- --target=rehearsal \"${KLUSTERED_SNAPSHOT_PATH:?set KLUSTERED_SNAPSHOT_PATH}\""]
			env: PATH: _taskPath
			dependsOn: [_t.migrate.rehearsal]
		}
	}

	reconcile: schema.#TaskGroup & {
		type: "group"
		rehearsal: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "\(_toolchain) bun run reconcile:static -- --target=rehearsal"]
			env: PATH: _taskPath
			dependsOn: [_t.setup]
		}
		production: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "\(_toolchain) bun run reconcile:static -- --target=production"]
			env: PATH: _taskPath
			dependsOn: [_t.setup]
		}
	}

	deploy: schema.#TaskGroup & {
		type: "group"
		migrate: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "\(_toolchain) bun run migrate:remote"]
			env: PATH: _taskPath
			dependsOn: [_t.setup, _t.deploy.ensureSecrets]
			inputs: [
				"src/migrations/**",
				"src/migrations-cuid2/**",
				"src/**",
				"scripts/migrate-production.ts",
				"scripts/lib/**",
				"payload.config.ts",
				"scripts/setup.mjs",
				"package.json",
				"wrangler.jsonc",
				"../../../bun.lock",
			]
		}

		ensureSecrets: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "set -eu; secrets=$(\(_toolchain) bun x wrangler secret list --config wrangler.jsonc); for name in PAYLOAD_SECRET PIPELINE_CALLBACK_SECRET; do if ! printf '%s' \"$secrets\" | grep -q \"$name\"; then \(_toolchain) bun -e 'process.stdout.write(require(\"node:crypto\").randomBytes(32).toString(\"hex\"))' | \(_toolchain) bun x wrangler secret put \"$name\" --config wrangler.jsonc; fi; done"]
			env: PATH: _taskPath
			dependsOn: [_t.setup]
			inputs: [
				"wrangler.jsonc",
				"package.json",
				"../../../bun.lock",
			]
		}

		migratePreview: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "\(_toolchain) bun run migrate:preview"]
			env: {
				PATH:                  _taskPath
				CI:                    schema.#EnvPassthrough
				CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
					ref: "op://sa.rawkode.academy/cloudflare/api-tokens/workers"
				}
				CLOUDFLARE_PREVIEW_ALLOW_DEGRADED_CONTAINERS: "true"
				GITHUB_EVENT_NAME:     schema.#EnvPassthrough
				GITHUB_EVENT_PATH:     schema.#EnvPassthrough
				GITHUB_SHA:            schema.#EnvPassthrough
			}
			dependsOn: [_t.build]
			inputs: [
				"src/migrations-cuid2/**",
				"scripts/migrate-preview.ts",
				"scripts/import-static.ts",
				"scripts/lib/import-target.ts",
				"scripts/lib/remote-target.ts",
				"scripts/pr-preview-resources.mjs",
				"src/static-content.ts",
				"../../../content/**",
				"../../../projects/rawkode.academy/website/**",
				"../../../bun.lock",
			]
		}

		main: schema.#Task & {
			hermetic: false
			command: "sh"
			// The tag lets the website review deploy wait for this exact commit.
			// It is the first 12 characters of the full SHA on both sides.
			args: ["-lc", "sha=$(git rev-parse HEAD); tag=$(printf '%s' \"$sha\" | cut -c1-12); \(_toolchain) bun x wrangler deploy --tag \"$tag\" --message \"$sha\""]
			env: PATH: _taskPath
			dependsOn: [_t.build, _t.deploy.migrate]
			// This is the production delivery root. The generated GitHub workflow
			// already limits invocations to this project; leaving inputs unset
			// makes cuenv treat it, and deploy.reviewRuntime through it, as
			// affected on every main invocation.
		}

		reviewRuntime: schema.#Task & {
			hermetic: false
			command: "sh"
			// The preview runtime binds the -preview D1/R2, so it migrates those
			// itself. It runs strictly after deploy.main: a migratePreview
			// dependency would run beside the production migrate, and a failure
			// there would abort the production deploy.
			args: ["-lc", "\(_toolchain) sh -c 'bun run migrate:preview && bun run deploy:preview-runtime'"]
			env: PATH: _taskPath
			dependsOn: [_t.deploy.main]
			inputs: [
				"src/**",
				"src/migrations/**",
				"container/**",
				"scripts/check-review-container-recipe.mjs",
				"worker.ts",
				"payload.config.ts",
				"open-next.config.ts",
				"next.config.mjs",
				"package.json",
				"wrangler.preview-runtime.jsonc",
				"tsconfig.json",
				"../../../bun.lock",
			]
		}

		preview: schema.#Task & {
			hermetic: false
			command: "sh"
			args: ["-lc", "\(_toolchain) bun run deploy:preview"]
			env: {
				PATH:                  _taskPath
				CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
					ref: "op://sa.rawkode.academy/cloudflare/api-tokens/workers"
				}
				CLOUDFLARE_PREVIEW_ALLOW_DEGRADED_CONTAINERS: "true"
				GITHUB_EVENT_NAME:     schema.#EnvPassthrough
				GITHUB_EVENT_PATH:     schema.#EnvPassthrough
				GITHUB_OUTPUT:         schema.#EnvPassthrough
				GITHUB_SHA:            schema.#EnvPassthrough
			}
			dependsOn: [_t.check, _t.test, _t.deploy.migratePreview]
			captures: previewUrl: {
				pattern: "Preview URL: (.+)"
			}
		}
	}
}
