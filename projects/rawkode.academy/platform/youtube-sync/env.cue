package cuenv

import (
	"list"

	"github.com/cuenv/cuenv/schema"
)

schema.#Project

name: "rawkode-academy-platform-youtube-sync"

// Writes video metadata (title, description footer) to the Academy YouTube
// channel from the Academy catalogue. Its write credential is separate from
// youtube-control's read-only one. Tasks run in this directory's flake.nix dev
// shell, pinned by flake.lock, so nothing depends on system or uv-downloaded
// toolchains (which don't run on NixOS).

let _t = tasks

// The deploy and the plan/apply tasks read their secrets from Infisical in CI.
_ciInfisicalOidc: true

let _infrastructure = [{allowInfrastructure: ["plan", "apply", "import", "destroy"]}]

// Where `cuenv task consent` writes the Google OAuth client, the write refresh
// token and the admin token CI uses to call the Worker. The github-actions
// identity (deploys on main) reads this folder; the path mirrors the monorepo.
_syncSecret: _infisicalSecret & {secretPath: "/projects/rawkode-academy/platform/youtube-sync"}

env: {
	// cuenv withholds Infisical credentials from providers unless the project
	// passes them explicitly. In CI the Infisical OIDC contributor sets them.
	INFISICAL_AUTH_JWT: {
		value: schema.#ExecSecret & {command: "printenv", args: ["INFISICAL_AUTH_JWT"]}
		policies: _infrastructure
	}
	INFISICAL_MACHINE_IDENTITY_ID: {
		value: schema.#ExecSecret & {command: "printenv", args: ["INFISICAL_MACHINE_IDENTITY_ID"]}
		policies: _infrastructure
	}
}

let _npm = "npm ci --workspaces=false --no-audit --no-fund >/dev/null && "
let _sources = ["src/**", "package.json", "package-lock.json", "wrangler.jsonc", "secrets.env", "flake.nix", "flake.lock"]

ci: pipelines: default: {
	environment: "production"
	when: {
		branch: ["main"]
		defaultBranch: true
		manual:        true
	}
	tasks: [_t.deploy]
}

// Run by hand from Actions: reads live YouTube, writes a plan to D1 and puts
// the diff report in the job summary. Writes nothing to YouTube.
ci: pipelines: plan: {
	environment: "production"
	when: manual: true
	tasks: [_t.plan]
}

// Run by hand from Actions: applies what apply.json allows from the latest
// plan. apply.json starts as a dry run of one video; its commit is the approval.
ci: pipelines: apply: {
	environment: "production"
	when: manual: true
	tasks: [_t.apply]
}

tasks: [string]: hermetic: false

tasks: {
	check: schema.#Task & {
		command: "sh"
		args: ["-c", _npm + "npm run check --workspaces=false"]
		inputs: list.Concat([_sources, ["test/**", "tsconfig.json", "secrets.d.ts"]])
	}
	test: schema.#Task & {
		command: "sh"
		args: ["-c", _npm + "npm test --workspaces=false"]
		inputs: list.Concat([_sources, ["test/**", "migrations/**"]])
	}

	// CI on main: tests, applies D1 migrations, creates the queues if missing, then deploys the Worker with its
	// secrets from Infisical. Fails if `cuenv task consent` hasn't stored them yet.
	deploy: schema.#Task & {
		command: "sh"
		args: ["-c", _npm + "npm test --workspaces=false && npx --no-install wrangler d1 migrations apply DB --remote && for q in platform-youtube-sync platform-youtube-sync-dlq platform-video-updated platform-video-updated-dlq; do npx --no-install wrangler queues info $q >/dev/null 2>&1 || npx --no-install wrangler queues create $q; done && npx --no-install wrangler deploy --secrets-file secrets.env"]
		inputs: list.Concat([_sources, ["env.cue", "test/**", "migrations/**"]])
		labels: ["infisical"]
		env: {
			YOUTUBE_SYNC_CLIENT_ID: _syncSecret & {secretName: "YOUTUBE_SYNC_CLIENT_ID"}
			YOUTUBE_SYNC_CLIENT_SECRET: _syncSecret & {secretName: "YOUTUBE_SYNC_CLIENT_SECRET"}
			YOUTUBE_SYNC_REFRESH_TOKEN: _syncSecret & {secretName: "YOUTUBE_SYNC_REFRESH_TOKEN"}
			SYNC_ADMIN_TOKEN: _syncSecret & {secretName: "SYNC_ADMIN_TOKEN"}
		}
	}

	// Run by hand, once, and again whenever a sync fails with
	// reauthorization_required: Google consent in the browser (write access to
	// the Academy channel's video metadata), credential to Infisical, then the
	// deploy workflow. Logs in to Infisical as the bootstrap machine identity.
	consent: schema.#Task & {
		command: "python"
		args: ["-I", "scripts/consent.py"]
		inputs: ["scripts/consent.py"]
		env: {
			INFISICAL_UNIVERSAL_AUTH_CLIENT_ID: schema.#OnePasswordRef & {ref: "op://Employee/Infisical/machine-identity/client-id"}
			INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET: schema.#OnePasswordRef & {ref: "op://Employee/Infisical/machine-identity/client-secret"}
			GOOGLE_OAUTH_CLIENT_ID: schema.#OnePasswordRef & {ref: "op://Employee/565nub77bcoxqd5a77kbdets3q/youtube-control/client-id"}
			GOOGLE_OAUTH_CLIENT_SECRET: schema.#OnePasswordRef & {ref: "op://Employee/565nub77bcoxqd5a77kbdets3q/youtube-control/client-secret"}
		}
	}

	plan: schema.#Task & {
		command: "bash"
		args: ["scripts/call.sh", "plan"]
		inputs: ["scripts/call.sh"]
		labels: ["infisical"]
		env: SYNC_ADMIN_TOKEN: _syncSecret & {secretName: "SYNC_ADMIN_TOKEN"}
	}

	apply: schema.#Task & {
		command: "bash"
		args: ["scripts/call.sh", "apply"]
		inputs: ["scripts/call.sh", "apply.json"]
		labels: ["infisical"]
		env: SYNC_ADMIN_TOKEN: _syncSecret & {secretName: "SYNC_ADMIN_TOKEN"}
	}
}
