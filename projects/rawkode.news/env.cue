package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-news"

let _t = tasks

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

		workspaces: ["bun"]

		inputs: [
			"astro.config.ts",
			"bun.lock",
			"package.json",
			"public/",
			"src/**",
		]
	}

	build: {
		command: "bun"
		args: ["run", "build"]

		workspaces: ["bun"]

		inputs: [
			"astro.config.ts",
			"bun.lock",
			"package.json",
			"public/",
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
