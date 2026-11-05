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

// infrastructure.cue needs nested output references (cuenv 0.67.0).
_cuenvBinary:     "0.67.0"
_ciInfisicalOidc: true

let _infrastructure = [{allowInfrastructure: ["plan", "apply", "import", "destroy"]}]

_cloudflareToken: schema.#OnePasswordRef & {
	ref: "op://sa.rawkode.academy/cloudflare/api-tokens/workers"
}

_infisicalSecret: schema.#InfisicalSecret & {
	projectId:   "6575a392d7a5ef0555ade86b"
	environment: "production"
	apiUrl:      "https://app.infisical.com"
}

// Where infrastructure.cue writes the Basin tokens.
_basinSecret: _infisicalSecret & {secretPath: "/projects/basin"}

env: {
	SERVICE_NAME:          "observability-collector"
	CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce"

	// Plan and apply run without an environment.
	CLOUDFLARE_API_TOKEN: {
		value: _infisicalSecret & {
			secretPath: "/infrastructure"
			secretName: "CLOUDFLARE_ROOT_TOKEN"
		}
		policies: _infrastructure
	}

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

	environment: production: {
		CLOUDFLARE_API_TOKEN: _cloudflareToken
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

	// CI can only read the root token on main, so pull requests can't plan.
	// Without a pull request plan, a change to the stream, sink or pipeline
	// replaces them as soon as it merges.
	infrastructure: {
		when: {
			branch: ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: [_t.infrastructure]
	}

	// Compaction and snapshot expiry aren't in the Cloudflare provider yet,
	// so infrastructure.cue can't enable them. Run once after the first apply.
	maintenance: {
		environment: "production"
		when: manual: true
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

	infrastructure: schema.#Task & {
		hermetic: false
		script:   "cuenv infra init && cuenv infrastructure apply --yes"
		inputs: ["basin/pipeline.sql", "basin/schema.json", "env.cue", "infrastructure.cue"]
		labels: ["infisical"]
	}

	// Secrets for these two tasks are scoped here, not to the environment, so
	// a missing Infisical secret can't break the collector's deploy.
	maintenance: schema.#Task & {
		hermetic: false
		command:  "bash"
		args: ["basin/maintenance.sh"]
		inputs: ["basin/maintenance.sh"]
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

	typegen: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["x", "wrangler", "types", "--env-interface", "CloudflareBindings"]
	}
}
