package cuenv

import (
	"github.com/cuenv/cuenv/schema"
	c "github.com/cuenv/cuenv/contrib/contributors"
)

let _removeDeterminateReceipt = """
	if [ -e /nix/receipt.json ]; then
	  if command -v sudo >/dev/null 2>&1; then
	    sudo rm -f /nix/receipt.json
	  else
	    rm -f /nix/receipt.json
	  fi
	fi
	"""

// Cache the Nix store on the Namespace runner's persistent volume and install
// Determinate Nix on top. Replaces the stock `c.#Nix` contributor so the
// cache, receipt cleanup, and install steps stay in a single ordered group.
let _NamespaceNix = schema.#Contributor & {
	id: "namespaceNix"
	tasks: [
		{
			id:       "namespaceNix.cache"
			label:    "Cache /nix on Namespace volume"
			priority: 0
			provider: github: {
				uses: "namespacelabs/nscloud-cache-action@v1"
				with: cache: "nix"
			}
		},
		{
			id:        "namespaceNix.prepareReceipt"
			label:     "Prepare Determinate receipt"
			priority:  1
			dependsOn: ["namespaceNix.cache"]
			script:    _removeDeterminateReceipt
		},
		{
			id:        "namespaceNix.install"
			label:     "Install Determinate Nix"
			priority:  2
			dependsOn: ["namespaceNix.prepareReceipt"]
			provider: github: {
				uses: "DeterminateSystems/determinate-nix-action@v3"
				with: "extra-conf": "accept-flake-config = true"
			}
		},
		{
			id:        "namespaceNix.cleanupReceipt"
			label:     "Prune Determinate Nix receipt"
			priority:  3
			dependsOn: ["namespaceNix.install"]
			script:    _removeDeterminateReceipt
		},
	]
}

schema.#Base

// A project may set _cuenvBinary to pin a different cuenv release for its own
// generated workflows; every other project keeps the repository-wide pin.
_cuenvBinary?: string

config: ci: cuenv: {
	source: "release"
	if _cuenvBinary == _|_ {
		version: "0.72.0"
	}
	if _cuenvBinary != _|_ {
		version: _cuenvBinary
	}
}

runtime: schema.#DevenvRuntime

hooks: onEnter: devenv: schema.#Devenv

// A project may set _ciRequireReport to its repository-relative path. `cuenv
// ci` skips a project whose env.cue fails to evaluate and still exits 0, so the
// generated workflow then fails unless cuenv wrote that project's pipeline
// report (.cuenv/reports/<sha>/<absolute project path with / as ->.json).
_ciRequireReport?: string

// A project that reads #InfisicalSecret values in CI sets _ciInfisicalOidc and
// labels those tasks "infisical". Only their pipelines log in to Infisical with
// the job's GitHub OIDC token, so a deploy that doesn't read Infisical never
// holds it.
_ciInfisicalOidc?: true

// A project whose infrastructure workflows read #InfisicalSecret values sets
// _ciInfisicalInfrastructure, so its plan and apply jobs log in.
_ciInfisicalInfrastructure?: true

// Which Infisical identity a job logs in as. infrastructure/bootstrap writes
// the IDs as repository variables. Infrastructure applies use
// github-read-write, whose login also requires the `infrastructure` GitHub
// environment, so a job that skipped review is refused even if it asks for it.
// Infrastructure plans on pull requests use github-read-only, which reads
// credentials that can't change anything. Deploys on main use github-actions,
// which reads project secrets.
let _infisicalIdentity = "${{ endsWith(github.workflow, '-infrastructure-apply') && vars.INFISICAL_READ_WRITE_IDENTITY_ID || endsWith(github.workflow, '-infrastructure-plan') && vars.INFISICAL_READ_ONLY_IDENTITY_ID || vars.INFISICAL_MACHINE_IDENTITY_ID }}"
let _infisicalOidcTasks = (c.#InfisicalOidc & {#identityId: _infisicalIdentity}).tasks

ci: providers: ["github"]

// Pull request jobs run code anyone with write access can change, so their
// GITHUB_TOKEN can read the repository and report checks, nothing more.
ci: pipelines: pullRequest?: provider: github: permissions: {
	contents: "read"
	packages: "none"
	actions:  "none"
	issues:   "none"
}
ci: contributors: [
	_NamespaceNix,
	c.#BunWorkspace,
	c.#CuenvRelease,
	c.#OnePassword,
	if _ciInfisicalOidc != _|_ {
		schema.#Contributor & {
			id: "infisical-oidc"
			when: taskLabels: ["infisical"]
			tasks: _infisicalOidcTasks
		}
	},
	if _ciInfisicalOidc != _|_ {
		schema.#Contributor & {
			id: "infisical"
			when: taskLabels: ["infisical"]
			tasks: c.#Infisical.tasks
		}
	},
	if _ciInfisicalInfrastructure != _|_ {
		schema.#Contributor & {
			id: "infisical-oidc"
			when: secretsProvider: ["infisical"]
			tasks: _infisicalOidcTasks
		}
	},
	if _ciInfisicalInfrastructure != _|_ {
		schema.#Contributor & {
			id: "infisical"
			when: secretsProvider: ["infisical"]
			tasks: c.#Infisical.tasks
		}
	},
	if _ciRequireReport != _|_ {
		schema.#Contributor & {
			id: "requireReport"
			tasks: [{
				id:       "requireReport.verify"
				label:    "Verify cuenv ran \(_ciRequireReport)"
				priority: 90
				script: """
					suffix=$(printf '%s' '\(_ciRequireReport)' | tr '/' '-')
					if ! ls ".cuenv/reports/${GITHUB_SHA}/"*"-${suffix}.json" >/dev/null 2>&1; then
					  echo "::error::cuenv ci wrote no pipeline report for \(_ciRequireReport). It skipped the project (evaluation failed or timed out; look for 'Failed to evaluate env.cue' above) or found no affected tasks."
					  exit 1
					fi
					"""
			}]
		}
	},
]

ci: provider: github: {
	runner: "namespace-profile-linux-x86"
	runners: arch: {
		"linux-x64":    "namespace-profile-linux-x86"
		"darwin-arm64": "namespace-profile-darwin-arm64"
		amd64:          "namespace-profile-linux-x86"
	}
}

vcs: "cuenv-skills": {
	url:       "https://github.com/cuenv/cuenv.git"
	reference: "main"
	vendor:    false
	subdir:    ".agents/skills"
	path:      ".agents/skills/cuenv"
}

env: {
	environment: production: {
		CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce"
		TF_WORKSPACE:          "production"
	}
}
