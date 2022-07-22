package weblinks

import (
	"dagger.io/dagger"
	"dagger.io/dagger/core"
	"universe.dagger.io/alpine"
	"universe.dagger.io/bash"
	"universe.dagger.io/yarn"
	"universe.dagger.io/alpha/doppler"
)

dagger.#Plan & {
	client: env: DOPPLER_TOKEN: dagger.#Secret

	actions: build: #Build & {
		config: doppler: token: client.env.DOPPLER_TOKEN
	}
}

#Build: {
	config: doppler: token: dagger.#Secret

	secrets: doppler.#FetchConfig & {
		apiToken: config.doppler.token
		project:  "weblinks"
		"config": "production"
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

	pushSecrets: bash.#Run & {
		input: _workerImage.output

		env: {
			"CLOUDFLARE_ACCOUNT_ID": secrets.output.CLOUDFLARE_ACCOUNT_ID.computed.contents
			"CLOUDFLARE_API_TOKEN":  secrets.output.CLOUDFLARE_API_TOKEN.computed.contents
			basicAuth:               secrets.output.RUDDERSTACK_BASIC_AUTH.computed.contents
		}

		script: contents: """
			set -x
			npm install --global wrangler
			echo "${basicAuth}" | npx wrangler --name web-links secret put basicAuth
			"""
	}

	deploy: yarn.#Script & {
		name:    "publish"
		project: "weblinks"
		source:  _workerCode.output

		container: {
			input: _workerImage.output

			env: CLOUDFLARE_ACCOUNT_ID: secrets.output.CLOUDFLARE_ACCOUNT_ID.computed.contents
			env: CLOUDFLARE_API_TOKEN:  secrets.output.CLOUDFLARE_API_TOKEN.computed.contents
		}
	}
}
