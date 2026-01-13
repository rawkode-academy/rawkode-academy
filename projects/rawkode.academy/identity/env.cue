package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-identity"

ci: pipelines: {
	default: {
		environment: "production"
		when: {
			branch:        ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: [tasks.deploy]
	}
}

tasks: {
	auth: {
		type: "group"
		generate: {
			command: "bun"
			args: ["x", "@better-auth/cli", "generate", "--config", "./src/lib/auth.config.ts", "--output", "./src/db/schema.ts", "-y"]
		}
	}

	bun: {
		type: "group"
		dev: {
			command: "bun"
			args: ["x", "wrangler", "dev"]
			inputs: [
				"astro.config.mjs",
				"bun.lock",
				"package.json",
				"src/**",
			]
		}
	}

	migrations: {
		type: "group"
		remote: {
			command: "bun"
			args: ["x", "wrangler", "d1", "migrations", "apply", "identity", "--remote"]
		}
	}

	build: {
		command: "bun"
		args: ["run", "build"]
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
		dependsOn: [migrations.remote, build]
		inputs: [
			"astro.config.mjs",
			"bun.lock",
			"package.json",
			"src/**",
		]
	}
}
