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

_ciInfisicalOidc:           true
_ciInfisicalInfrastructure: true

let _infrastructure = [{allowInfrastructure: ["plan", "apply", "import", "destroy"]}]

// Where infrastructure.cue writes the Basin tokens.
_basinSecret: _infisicalSecret & {secretPath: "/projects/basin"}

env: {
	SERVICE_NAME:          "observability-collector"
	CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce"

	// cuenv withholds Infisical credentials from providers unless the project
	// passes them explicitly. The Infisical provider logs in with these; in CI
	// the Infisical OIDC contributor sets them.
	INFISICAL_AUTH_JWT: {
		value: schema.#ExecSecret & {command: "printenv", args: ["INFISICAL_AUTH_JWT"]}
		policies: _infrastructure
	}
	INFISICAL_MACHINE_IDENTITY_ID: {
		value: schema.#ExecSecret & {command: "printenv", args: ["INFISICAL_MACHINE_IDENTITY_ID"]}
		policies: _infrastructure
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

	// Read-only, bounded daily ID parity; never a complete cutover decision.
	evidence: {
		environment: "production"
		when: {
			manual: true
			scheduled: "30 6 * * *"
		}
		tasks: [_t.evidence]
	}

	// Compaction and snapshot expiry aren't in the Cloudflare provider yet,
	// so infrastructure.cue can't enable them. Runs on main when the script or
	// the infrastructure (and so the catalog token) changes.
	maintenance: {
		environment: "production"
		when: {
			branch: ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: [_t.maintenance]
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

	// Secrets for these tasks are scoped here, not to the environment, so
	// a missing Infisical secret can't break the collector's deploy.
	maintenance: schema.#Task & {
		hermetic: false
		command:  "bash"
		args: ["basin/maintenance.sh"]
		inputs: ["basin/maintenance.sh", "infrastructure.cue"]
		labels: ["infisical"]
		env: BASIN_CATALOG_TOKEN: _basinSecret & {secretName: "BASIN_CATALOG_TOKEN"}
	}

	"drop-legacy-table": schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["basin/drop-legacy-table.ts"]
		inputs: ["basin/drop-legacy-table.ts", "infrastructure.cue"]
		labels: ["infisical"]
		env: BASIN_CATALOG_TOKEN: _basinSecret & {secretName: "BASIN_CATALOG_TOKEN"}
	}

	reconcile: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["basin/reconcile.ts"]
		env: {
			BASIN_SQL_TOKEN: _basinSecret & {secretName: "BASIN_SQL_TOKEN"}
			POSTHOG_PROJECT_ID: "12084"
			POSTHOG_PERSONAL_API_KEY: schema.#OnePasswordRef & {
				ref: "op://sa.rawkode.academy/posthog/personal-api-key"
			}
		}
	}

	evidence: schema.#Task & {
		hermetic: false
		command: "bun"
		args: ["basin/ci-evidence.ts"]
		inputs: ["basin/**"]
		labels: ["infisical"]
		env: {
			BASIN_SQL_TOKEN: _basinSecret & {secretName: "BASIN_SQL_TOKEN"}
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
