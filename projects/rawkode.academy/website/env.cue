package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-website"

env: {
	GRAPHQL_ENDPOINT:  "https://api.rawkode.academy/"
	DISABLE_GAME_AUTH: true
}

ci: pipelines: {
	default: {
		environment: "production"
		when: {
			branch: ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: ["deploy.upload", "deploy.activate"]
	}

	pullRequest: {
		when: {
			pullRequest: true
		}
		tasks: ["deploy.upload-preview"]
	}
}

tasks: {
	dev: {
		command: "bun"
		args: ["run", "dev"]

		inputs: [
			"astro.config.mts",
			"package.json",
			"public/**",
			"src/**",
		]
	}

	build: {
		command: "bun"
		args: ["run", "build"]

		inputs: [
			"astro.config.mts",
			"package.json",
			"public/**",
			"src/**",
		]

		outputs: [
			"dist/**",
		]
	}

	deploy: upload: {
		command: "bun"
		args: ["x", "wrangler", "versions", "upload"]
		dependsOn: ["build"]
	}

	deploy: "upload-preview": {
		command: "bun"
		args: ["x", "wrangler", "versions", "upload", "--preview-alias", "pr-${{ github.event.pull_request.number }}"]
		dependsOn: ["build"]
	}

	deploy: activate: {
		command: "bun"
		args: ["x", "wrangler", "versions", "deploy"]
		dependsOn: ["deploy.upload"]
	}
}
