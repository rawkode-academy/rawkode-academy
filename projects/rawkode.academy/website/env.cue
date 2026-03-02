package cuenv

import "github.com/cuenv/cuenv/schema"

import xTools "github.com/cuenv/cuenv/contrib/tools"

schema.#Project

name: "rawkode-academy-website"

hooks: onEnter: devenv: schema.#Devenv

runtime: schema.#ToolsRuntime & {
	tools: {
		d2: xTools.#D2 & {version: "0.7.1"}
	}
}

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
		environment: "production"
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
			args: ["x", "wrangler", "versions", "upload"]
			dependsOn: [_t.build]
		}
	}
}
