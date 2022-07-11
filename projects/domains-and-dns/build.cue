package domains_dns

import (
	"dagger.io/dagger"
	"dagger.io/dagger/core"
	"universe.dagger.io/alpha/pulumi"
)

config: {
	cloudflare: {
		apiToken:  dagger.#Secret
		accountId: string
	}
	pulumi: {
		accessToken: dagger.#Secret
	}
}

build: {
	_codePulumi: core.#Source & {
		path: "."
		exclude: [
			"./node_modules",
		]
	}

	pulumiUp: pulumi.#Up & {
		stack:       "rawkode-academy/production"
		stackCreate: true
		runtime:     "nodejs"
		accessToken: config.pulumi.accessToken
		source:      _codePulumi.output

		container: env: {
			CLOUDFLARE_ACCOUNT_ID: config.cloudflare.accountId
			CLOUDFLARE_API_TOKEN:  config.cloudflare.apiToken
		}
	}
}
