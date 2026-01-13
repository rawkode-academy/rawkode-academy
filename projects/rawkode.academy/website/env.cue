package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-website"

let _t = tasks

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
		tasks: [_t.deploy.main]
	}

	pullRequest: {
		when: {
			pullRequest: true
		}
		tasks: [_t.deploy.preview]
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

	deploy: {
		type: "group"
		main: {
			command: "bun"
			args: ["x", "wrangler", "deploy"]
			dependsOn: [_t.build]
		}
		preview: {
			command: "bun"
			args: ["x", "wrangler", "versions", "upload", "--preview-alias", "pr-${{ github.event.pull_request.number }}"]
			dependsOn: [_t.build]
		}
	}
}
