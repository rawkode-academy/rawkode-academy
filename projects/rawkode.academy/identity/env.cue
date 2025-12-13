package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-identity"

workspaces: bun: {}

tasks: {
	auth: {
		generate: {
			command: "bunx"
			args: ["@better-auth/cli", "generate", "--config", "./src/lib/auth.config.ts", "--output", "./src/db/schema.ts", "-y"]
			workspaces: ["bun"]
		}
	}

	bun: {
		install: {
			command: "bun"
			args: ["install"]
			workspaces: ["bun"]
			inputs: ["bun.lock", "package.json"]
		}

		dev: {
			command: "bunx"
			args: ["wrangler", "dev"]
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
		production: {
			command: "bun"
			args: ["wrangler", "d1", "migrations", "apply", "identity", "--remote"]
			workspaces: ["bun"]
		}
	}

	deploy: {
		command: "bun"
		args: ["wrangler", "deploy"]
		workspaces: ["bun"]
		inputs: [
			"astro.config.mjs",
			"bun.lock",
			"package.json",
			"src/**",
		]
	}
}
