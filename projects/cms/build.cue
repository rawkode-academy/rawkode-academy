package cms

import (
	"dagger.io/dagger"
	"dagger.io/dagger/core"
	"universe.dagger.io/docker"
	"universe.dagger.io/yarn"
)

#Build: {
	config: {
		github: token: dagger.#Secret
	}

	_cmsCode: core.#Source & {
		path: "./payloadcms"
		exclude: [
			"./dist",
			"./node_modules",
		]
	}

	buildCmd: yarn.#Script & {
		source:  _cmsCode.output
		project: "cms"
		name:    "build:server"
		container: env: YARN_OUTPUT_FOLDER: "dist"
	}

	buildImage: docker.#Build & {
		steps: [
			docker.#Pull & {
				source: "node:18"
			},

			docker.#Copy & {
				contents: buildCmd.container.export.directories."/output"
				dest:     "/app"
			},

			docker.#Set & {
				config: cmd: ["node", "/app/server.js"]
			},
		]
	}

	pushImage: docker.#Push & {
		image: buildImage.output
		dest:  "ghcr.io/rawkodeacademy/cms:latest"

		auth: {
			username: "rawkode"
			secret:   config.github.token
		}
	}
}
