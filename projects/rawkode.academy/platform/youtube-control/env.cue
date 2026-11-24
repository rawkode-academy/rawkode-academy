package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-youtube-control"

// This isolated PoC has no automatic deploy pipeline. Provisioned IDs and
// owner credentials are configured through scripts/setup.mjs and Worker secrets.
tasks: [string]: hermetic: false

tasks: {
	install: schema.#Task & {
		command: "npm"
		args: ["ci", "--workspaces=false", "--no-audit", "--no-fund"]
		inputs: ["package.json", "package-lock.json"]
	}
	check: schema.#Task & {
		command: "npm"
		args: ["run", "check", "--workspaces=false"]
		inputs: ["src/**", "test/**", "scripts/**", "package.json", "package-lock.json", "tsconfig.json", "secrets.d.ts", "wrangler.jsonc"]
	}
	test: schema.#Task & {
		command: "npm"
		args: ["test", "--workspaces=false"]
		inputs: ["src/**", "test/**", "scripts/**", "infra/**", "package.json", "package-lock.json", "wrangler.jsonc"]
	}
	build: schema.#Task & {
		command: "npm"
		args: ["run", "build", "--workspaces=false"]
		inputs: ["src/**", "package.json", "package-lock.json", "wrangler.jsonc"]
	}
}
