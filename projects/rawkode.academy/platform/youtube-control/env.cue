package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-platform-youtube-control"

// No automatic deploy pipeline yet: deploy with `npm run deploy` after the
// Worker secrets in README.md are set.
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
		inputs: ["src/**", "test/**", "package.json", "package-lock.json", "tsconfig.json", "secrets.d.ts", "wrangler.jsonc"]
	}
	test: schema.#Task & {
		command: "npm"
		args: ["test", "--workspaces=false"]
		inputs: ["src/**", "test/**", "package.json", "package-lock.json", "wrangler.jsonc"]
	}
	build: schema.#Task & {
		command: "npm"
		args: ["run", "build", "--workspaces=false"]
		inputs: ["src/**", "package.json", "package-lock.json", "wrangler.jsonc"]
	}
}
