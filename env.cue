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

runtime: schema.#DevenvRuntime

hooks: onEnter: devenv: schema.#Devenv

ci: providers: ["github"]
ci: contributors: [
	_NamespaceNix,
	c.#BunWorkspace,
	c.#CuenvRelease,
	c.#OnePassword,
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
	path:      ".agents/skills"
}

env: {
	environment: production: {
		CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce"
		TF_WORKSPACE:          "production"
	}
}
