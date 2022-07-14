package weblinks

import (
	"dagger.io/dagger"
	"dagger.io/dagger/core"
	"universe.dagger.io/alpine"
	"universe.dagger.io/bash"
	"universe.dagger.io/yarn"
)

#Build: {
	config: {
		cloudflare: {
			accountId: string
			apiToken:  dagger.#Secret
		}
		rudderStack: {
			basicAuth: dagger.#Secret
		}
	}

	_workerCode: core.#Source & {
		path: "."
		exclude: [
			"./node_modules",
		]
	}

	_workerImage: alpine.#Build & {
		packages: {
			bash: {}
			nodejs: {}
			npm: {}
			yarn: {}
		}
	}

	secrets: bash.#Run & {
		input: _workerImage.output

		env: {
			CLOUDFLARE_ACCOUNT_ID: config.cloudflare.accountId
			if config.cloudflare.apiToken != _|_ {
				CLOUDFLARE_API_TOKEN: config.cloudflare.apiToken
			}
			if config.rudderStack.basicAuth != _|_ {
				basicAuth: config.rudderStack.basicAuth
			}
		}

		script: contents: """
			set -x
			npm install --global wrangler
			echo "${basicAuth}" | npx wrangler --name web-links secret put basicAuth
			"""
	}

	deploy: yarn.#Script & {
		name:    "publish"
		project: "web-links"
		source:  _workerCode.output

		container: {
			input: _workerImage.output

			env: {
				CLOUDFLARE_ACCOUNT_ID: config.cloudflare.accountId
				if config.cloudflare.apiToken != _|_ {
					CLOUDFLARE_API_TOKEN: config.cloudflare.apiToken
				}
			}
		}
	}
}
