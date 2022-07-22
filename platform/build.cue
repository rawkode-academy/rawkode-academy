package platform

import (
	"dagger.io/dagger"
	"dagger.io/dagger/core"
	"universe.dagger.io/docker"
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
		project:  "platform"
		"config": "production"
	}

	_codePulumi: core.#Source & {
		path: "."
		exclude: [
			"./node_modules",
		]
	}

	pulumiUp: pulumi.#Up & {
		// cacheKey: "platform-production"
		stack:   "production"
		runtime: "nodejs"

		if secrets.output.PULUMI_ACCESS_TOKEN.computed != _|_ {
			accessToken: secrets.output.PULUMI_ACCESS_TOKEN.computed.contents
		}

		source: _codePulumi.output

		container: env: {
			if secrets.output.SCW_PROJECT_ID.computed != _|_ {
				SCW_PROJECT_ID: secrets.output.SCW_PROJECT_ID.computed.contents
			}
			if secrets.output.SCW_ACCESS_KEY.computed != _|_ {
				SCW_ACCESS_KEY: secrets.output.SCW_ACCESS_KEY.computed.contents
			}
			if secrets.output.SCW_SECRET_KEY.computed != _|_ {
				SCW_SECRET_KEY: secrets.output.SCW_SECRET_KEY.computed.contents
			}
		}
	}

	_dopplerImage: docker.#Pull & {
		source: "dopplerhq/cli:latest"
	}

	uploadKubeconfig: docker.#Run & {
		input: _dopplerImage.output

		env: {
			DOPPLER_TOKEN: config.doppler.token
			if pulumiUp.output.kubeconfig != _|_ {
				KUBECONFIG: pulumiUp.output.kubeconfig.contents
			}
		}

		entrypoint: ["ash"]
		command: {
			name: "-c"
			args: [" doppler secrets set --silent KUBECONFIG=\"$KUBECONFIG\""]
		}
	}
}
