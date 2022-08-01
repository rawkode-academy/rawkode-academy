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
		// Tag this image correctly and pass to Pulumi
		dest: "ghcr.io/rawkodeacademy/cms:latest"

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

	// We never run the Pulumi within Dagger
	// as it's expected to run in a GitOps workflow
}
