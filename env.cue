package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Cuenv

env: CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce"

hooks: onEnter: nix: schema.#ExecHook & { command: "devenv", args: ["print-dev-env"], inputs: ["devenv.nix", "devenv.lock", "devenv.yaml"]  }

