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
env: {
	GRAPHQL_ENDPOINT: "https://api.rawkode.academy/"
	// Bypass the game login gate in local dev only. Production MUST require
	// login (games read Astro.locals.user); the production override forces it off.
	DISABLE_GAME_AUTH: true
	environment: production: {
		DISABLE_GAME_AUTH: false
		// Worker secret for POST /api/cache/invalidate; scripts/wrangler-deploy.ts
		// uploads it with every deploy and preview.
		CACHE_INVALIDATION_TOKEN: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/website-cache-invalidation/password"
		}
	}
}

ci: pipelines: {
	default: {
		when: {
			branch: ["main"]
			defaultBranch: true
			manual:        true
		}
		// Hold deployment until the Studio and viewer rollout is coordinated.
		// deploy.main reads BASIN_SQL_TOKEN from Infisical, so set
		// _ciInfisicalOidc when this pipeline runs it.
		tasks: [_t.build]
	}

	pullRequest: {
		when: {
			pullRequest: true
		}
		tasks: [_t.build]
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
			"../../../packages/live-viewer/**",
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
			// Content is served live from the API gateway, so content/** is no
			// longer a build input.
			"astro.config.mts",
			"env.cue",
			"../../../packages/design-system/**",
			"../../../packages/rich-text/**",
			"package.json",
			"../../../bun.lock",
			"../../../packages/live-viewer/**",
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

	deploy: schema.#TaskGroup & {
		type: "group"
		main: schema.#Task & {
			hermetic: false
			command:  "sh"
			args: [
				"-lc",
				"\(_toolchain) sh -c 'bun run build && bun scripts/wrangler-deploy.ts deploy --config ./dist/server/wrangler.json --purge'",
			]
			env: {
				PATH: _taskPath
				// Written to Infisical by the observability collector's
				// infrastructure.cue. scripts/wrangler-deploy.ts uploads it.
				BASIN_SQL_TOKEN: schema.#InfisicalSecret & {
					projectId:   "6575a392d7a5ef0555ade86b"
					environment: "production"
					secretPath:  "/projects/basin"
					secretName:  "BASIN_SQL_TOKEN"
					apiUrl:      "https://app.infisical.com"
				}
			}
			// env.cue drives build-time vars (e.g. DISABLE_GAME_AUTH); include it so
			// an env-only change marks this deploy affected (else CI skips it).
			inputs: [
				// Content is served live from the API gateway, so content/** is no
				// longer a deploy input.
				"astro.config.mts",
				"env.cue",
				"../../../packages/design-system/**",
				"../../../packages/rich-text/**",
				"package.json",
				"../../../bun.lock",
				"../../../packages/live-viewer/**",
				"scripts/**",
				"vitest.config.ts",
				"public/**",
				"src/**",
				"wrangler.jsonc",
			]
		}
		preview: schema.#Task & {
			hermetic: false
			command:  "sh"
			args: ["-lc", "\(_toolchain) bun scripts/wrangler-deploy.ts versions upload"]
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
