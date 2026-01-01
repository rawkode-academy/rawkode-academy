package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-identity"

workspaces: bun: {}

ci: pipelines: [
	{
		name:        "default"
		environment: "production"
		when: {
			branch:        ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: ["deploy"]
	},
]

tasks: {
	auth: {
		generate: {
			command: "bun"
			args: ["x", "@better-auth/cli", "generate", "--config", "./src/lib/auth.config.ts", "--output", "./src/db/schema.ts", "-y"]
			workspaces: ["bun"]
		}
	}

	bun: {
		dev: {
			command: "bun"
			args: ["x", "wrangler", "dev"]
			workspaces: ["bun"]
			inputs: [
				"astro.config.mjs",
				"bun.lock",
				"package.json",
				"src/**",
			]
		}
	}

	migrations: {
		remote: {
			command: "bun"
			args: ["x", "wrangler", "d1", "migrations", "apply", "identity", "--remote"]
			workspaces: ["bun"]
		}
	}

	build: {
		command: "bun"
		args: ["run", "build"]
		workspaces: ["bun"]
		inputs: [
			"astro.config.mjs",
			"bun.lock",
			"package.json",
			"src/**",
		]
	}

	deploy: {
		command: "bun"
		args: ["x", "wrangler", "deploy"]
		workspaces: ["bun"]
		dependsOn: ["migrations.remote", "build"]
		inputs: [
			"astro.config.mjs",
			"bun.lock",
			"package.json",
			"src/**",
		]
	}
}
