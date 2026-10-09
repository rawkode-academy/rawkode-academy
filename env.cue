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
		version: "0.55.1"
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

ci: providers: ["github"]
ci: contributors: [
	_NamespaceNix,
	c.#BunWorkspace,
	c.#CuenvRelease,
	c.#OnePassword,
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
