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
		tasks: [_t.check, _t.test, _t.build, _t.e2e, _t.deploy.main]
	}
	pullRequest: {
		environment: "production"
		when: { pullRequest: true }
		tasks: [_t.check, _t.test, _t.build, _t.e2e, _t.deploy.preview]
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
		inputs: ["src/**", "tsconfig.json", "package.json", "../../bun.lock"]
	}
	test: schema.#Task & {
		hermetic: false
		command: "bun"
		args: ["run", "test"]
		inputs: ["src/**", "tests/**", "package.json", "../../bun.lock"]
	}
	e2e: schema.#Task & {
		hermetic: false
		command: "sh"
		args: ["-lc", "bun x playwright install --with-deps chromium && bun run test:e2e"]
		dependsOn: [_t.build]
		inputs: ["src/**", "e2e/**", "dist/**", "package.json", "../../bun.lock"]
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
		outputs: ["dist/**"]
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
			args: ["run", "deploy"]
			dependsOn: [_t.build]
				inputs: ["src/**", "tests/**", "migrations/**", "astro.config.mts", "panda.config.ts", "wrangler.jsonc", "package.json", "../../bun.lock"]
		}
		preview: schema.#Task & {
			hermetic: false
			command: "bun"
			args: ["run", "deploy:preview"]
			dependsOn: [_t.check, _t.test, _t.build]
				inputs: ["src/**", "tests/**", "migrations/**", "astro.config.mts", "panda.config.ts", "wrangler.jsonc", "package.json", "../../bun.lock"]
		}
	}
}
