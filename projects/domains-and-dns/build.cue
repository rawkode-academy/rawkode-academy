package domains

import (
	"dagger.io/dagger"
	"dagger.io/dagger/core"
	"universe.dagger.io/alpha/doppler"
	"universe.dagger.io/alpha/pulumi"
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
		project:  "domains-and-dns"
		"config": "production"
	}

	_codePulumi: core.#Source & {
		path: "."
		exclude: [
			"./node_modules",
		]
	}

	pulumiUp: pulumi.#Up & {
		stack:       "RawkodeAcademy/production"
		stackCreate: true
		runtime:     "nodejs"
		accessToken: secrets.output.PULUMI_ACCESS_TOKEN.computed.contents
		source:      _codePulumi.output

		container: env: {
			CLOUDFLARE_ACCOUNT_ID: secrets.output.CLOUDFLARE_ACCOUNT_ID.computed.contents
			CLOUDFLARE_API_TOKEN:  secrets.output.CLOUDFLARE_API_TOKEN.computed.contents
		}
	}
}
