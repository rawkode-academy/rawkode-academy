package cuenv

import (
	"list"

	"github.com/cuenv/cuenv/schema"
)

schema.#Project

name: "rawkode-tools-observability-collector"

let _t = tasks

let _deployInputs = [
	"env.cue",
	"package.json",
	"src/**",
	"wrangler.jsonc",
]

env: {
	SERVICE_NAME:          "observability-collector"
	CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce"

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
			manual:        true
		}
		tasks: [_t.deploy]
	}

	// Streams, sinks and pipeline SQL are immutable, so provisioning is a
	// deliberate, manual run rather than part of every deploy.
	provision: {
		environment: "production"
		when: manual: true
		tasks: [_t.provision]
	}
}

tasks: {
	dev: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["x", "wrangler", "dev"]
	}

	test: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["test"]
		inputs: list.Concat([_deployInputs, ["basin/**", "test/**"]])
	}

	deploy: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["x", "wrangler", "deploy"]
		dependsOn: [_t.test]
		inputs: _deployInputs
	}

	// Secrets for these two tasks are scoped here, not to the environment, so
	// a missing 1Password item can't break the collector's deploy.
	provision: schema.#Task & {
		hermetic: false
		command:  "bash"
		args: ["basin/provision.sh"]
		inputs: ["basin/**"]
		env: {
			// R2 Admin Read & Write: used by the Iceberg sink and table maintenance.
			BASIN_CATALOG_TOKEN: schema.#OnePasswordRef & {
				ref: "op://sa.rawkode.academy/cloudflare/api-tokens/basin-catalog"
			}
		}
	}

	reconcile: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["basin/reconcile.ts"]
		env: {
			BASIN_SQL_TOKEN: schema.#OnePasswordRef & {
				ref: "op://sa.rawkode.academy/cloudflare/api-tokens/basin-sql-read"
			}
			POSTHOG_PROJECT_ID: "12084"
			POSTHOG_PERSONAL_API_KEY: schema.#OnePasswordRef & {
				ref: "op://sa.rawkode.academy/posthog/personal-api-key"
			}
		}
	}

	typegen: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["x", "wrangler", "types", "--env-interface", "CloudflareBindings"]
	}
}
