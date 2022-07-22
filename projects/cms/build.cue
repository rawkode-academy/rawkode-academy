package cms

import (
	"dagger.io/dagger"
	"dagger.io/dagger/core"
	"universe.dagger.io/docker"
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
		project:  "cms"
		"config": "production"
	}

	_cmsCode: core.#Source & {
		path: "./payloadcms"
		exclude: [
			"./dist",
			"./node_modules",
		]
	}

	_buildImage: docker.#Dockerfile & {
		source: _cmsCode.output
		platforms: ["linux/amd64"]
	}

	_pushImage: docker.#Push & {
		image: _buildImage.output
		dest:  "ghcr.io/rawkodeacademy/cms:latest"

		auth: {
			username: "rawkode"
			secret:   secrets.output.GITHUB_TOKEN.computed.contents
		}
	}

	_codePulumi: core.#Source & {
		path: "./pulumi"
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
			if secrets.output.MONGODB_ATLAS_ORG_ID.computed != _|_ {
				MONGODB_ATLAS_ORG_ID: secrets.output.MONGODB_ATLAS_ORG_ID.computed.contents
			}
			if secrets.output.MONGODB_ATLAS_PUBLIC_KEY.computed != _|_ {
				MONGODB_ATLAS_PUBLIC_KEY: secrets.output.MONGODB_ATLAS_PUBLIC_KEY.computed.contents
			}
			if secrets.output.MONGODB_ATLAS_PRIVATE_KEY.computed != _|_ {
				MONGODB_ATLAS_PRIVATE_KEY: secrets.output.MONGODB_ATLAS_PRIVATE_KEY.computed.contents
			}
		}
	}
}
