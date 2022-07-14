package website

import (
	"dagger.io/dagger"
	"dagger.io/dagger/core"
	"universe.dagger.io/docker"
	"universe.dagger.io/yarn"
)

#Build: {
	config: {
		cloudflare: {
			accountId: string
			apiToken:  dagger.#Secret
		}
	}

	_websiteCode: core.#Source & {
		path: "."
		exclude: [
			"./dist",
			"./node_modules",
		]
	}

	_websiteImage: docker.#Pull & {
		source: "node:current-slim"
	}

	_deploy: yarn.#Script & {
		name:    "deploy"
		project: "website"
		source:  _websiteCode.output

		install: container: input: _websiteImage.output

		container: {
			input: _websiteImage.output

			env: {
				CLOUDFLARE_ACCOUNT_ID: config.cloudflare.accountId
				if config.cloudflare.apiToken != _|_ {
					CLOUDFLARE_API_TOKEN: config.cloudflare.apiToken
				}
			}
		}
	}
}
