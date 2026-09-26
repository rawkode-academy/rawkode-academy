package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-arcade"

runtime: schema.#DevenvRuntime

let _t = tasks

ci: pipelines: {
	default: {
		environment: "production"
		when: { branch: ["main"], defaultBranch: true, manual: true }
		// Deployment's validation prerequisite runs every gate in sequence.
		tasks: [_t.deploy.main]
	}
	pullRequest: {
		// Pull-request validation is intentionally hermetic. Production secrets are
		// resolved only by the default-branch deployment pipeline.
		environment: "development"
		when: { pullRequest: true }
		tasks: [_t.deploy.preview]
	}
}

env: {
	TICKET_SECRET: "local-development-secret-change-me"
	SESSION_SECRET: "local-development-secret-change-me"
	ENVIRONMENT: "development"
	CF_ACCESS_TEAM_DOMAIN: ""
	CF_ACCESS_AUD: ""
	OPERATOR_EMAILS: ""

	environment: production: {
		CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {ref: "op://sa.rawkode.academy/cloudflare/api-tokens/workers"}
		TICKET_SECRET: schema.#OnePasswordRef & {ref: "op://sa.rawkode.academy/arcade/ticket-secret"}
		SESSION_SECRET: schema.#OnePasswordRef & {ref: "op://sa.rawkode.academy/arcade/session-secret"}
		CF_ACCESS_TEAM_DOMAIN: schema.#OnePasswordRef & {ref: "op://sa.rawkode.academy/arcade/access-team-domain"}
		CF_ACCESS_AUD: schema.#OnePasswordRef & {ref: "op://sa.rawkode.academy/arcade/access-aud"}
		OPERATOR_EMAILS: schema.#OnePasswordRef & {ref: "op://sa.rawkode.academy/arcade/operator-emails"}
	}
}

tasks: {
	check: schema.#Task & {
		hermetic: false
		command: "bun"
		args: ["run", "check"]
		// panda.config.ts and astro.config.mts are load-bearing for `check`:
		// it runs panda codegen and the design-token guard, which reads the
		// token values straight out of the config.
		inputs: ["src/**", "scripts/**", "tsconfig.json", "panda.config.ts", "astro.config.mts", "wrangler.jsonc", "env.cue", "package.json", "devenv.nix", "../../bun.lock"]
		outputs: ["styled-system/**", ".astro/**"]
	}
	test: schema.#Task & {
		hermetic: false
		command: "bun"
		args: ["run", "test"]
		inputs: ["src/**", "tests/**", "scripts/**", "migrations/**", "vitest.config.ts", "wrangler.test.jsonc", "panda.config.ts", "package.json", "../../bun.lock"]
	}
	e2e: schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "bun x playwright install --with-deps chromium && bun run test:e2e"]
		// Task environments are explicit: do not rely on the runner's CI variable
		// surviving cuenv's environment filtering.
		env: CI: "true"
		dependsOn: [_t.build]
		inputs: ["src/**", "e2e/**", "scripts/**", "dist/**", "wrangler.jsonc", "package.json", "../../bun.lock"]
	}
	dev: schema.#Task & {
		hermetic: false
		command: "bun"
		args: ["run", "dev"]
	}
	build: schema.#Task & {
		hermetic: false
		command: "bun"
		args: ["run", "build"]
		inputs: ["src/**", "scripts/**", "public/**", "astro.config.mts", "panda.config.ts", "tsconfig.json", "wrangler.jsonc", "env.cue", "package.json", "devenv.nix", "../../bun.lock"]
		outputs: ["dist/**", ".wrangler/deploy/config.json"]
	}
	validate: schema.#Task & {
		hermetic: false
		command: "bun"
		args: ["run", "validate"]
		env: CI: "true"
		// Keep workerd users sequential and build exactly once. A single task
		// also avoids deeply expanded CUE task references during evaluation.
		inputs: ["src/**", "tests/**", "e2e/**", "scripts/**", "public/**", "migrations/**", "astro.config.mts", "panda.config.ts", "tsconfig.json", "vitest.config.ts", "wrangler.jsonc", "wrangler.test.jsonc", "env.cue", "package.json", "devenv.nix", "../../bun.lock"]
		outputs: ["dist/**", "styled-system/**", ".astro/**", ".wrangler/deploy/config.json"]
	}
	migrate: schema.#TaskGroup & {
		type: "group"
		remote: schema.#Task & {
			hermetic: false
			command: "bun"
			args: ["run", "db:migrate:remote"]
			dependsOn: [_t.build]
			inputs: ["migrations/**", "wrangler.jsonc", "package.json", "../../bun.lock"]
		}
	}
	deploy: schema.#TaskGroup & {
		type: "group"
		main: schema.#Task & {
			hermetic: false
			command: "bun"
			// Deploy the exact artifact that passed browser validation.
			args: ["run", "deploy:built"]
			dependsOn: [_t.validate]
			inputs: ["src/**", "tests/**", "e2e/**", "scripts/**", "migrations/**", "astro.config.mts", "panda.config.ts", "wrangler.jsonc", "package.json", "../../bun.lock"]
		}
		preview: schema.#Task & {
			hermetic: false
			command: "bun"
			args: ["run", "deploy:preview:built"]
			dependsOn: [_t.validate]
			inputs: ["src/**", "tests/**", "e2e/**", "scripts/**", "migrations/**", "astro.config.mts", "panda.config.ts", "wrangler.jsonc", "package.json", "../../bun.lock"]
		}
	}
}
