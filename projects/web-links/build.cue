package web_links

import (
	"dagger.io/dagger"
	"dagger.io/dagger/core"
	"universe.dagger.io/yarn"
)

config: {
	cloudflare: {
		accountId: string
		apiToken:  dagger.#Secret
	}
}

actions: {
	_codeWorker: core.#Source & {
		path: "."
		exclude: [
			"./node_modules",
		]
	}

	deploy: yarn.#Script & {
		name:   "publish"
		source: _codeWorker.output

		container: env: {
			CLOUDFLARE_ACCOUNT_ID: config.cloudflare.accountId
			if config.cloudflare.apiToken != _|_ {
				CLOUDFLARE_API_TOKEN: config.cloudflare.apiToken
			}
		}
	}
}
