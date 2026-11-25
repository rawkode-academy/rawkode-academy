package cuenv

import (
	"github.com/cuenv/cuenv/schema"
	xNix "github.com/cuenv/cuenv/contrib/nix"
)

schema.#Project

name: "rawkode-academy-identity"

runtime: schema.#NixRuntime
hooks: onEnter: nix: xNix.#NixFlake

let _t = tasks

ci: pipelines: {
	default: {
		environment: "production"
		when: {
			branch: ["main"]
			defaultBranch: true
			manual:        true
		}
		tasks: [_t.deploy]
	}
	// Run by hand from Actions: read-only report of how the Rawkode Tools
	// operator role resolves in production (no emails or names).
	diagnose: {
		environment: "production"
		when: manual: true
		tasks: [_t.diagnose]
	}
}

tasks: {
	auth: schema.#TaskGroup & {
		type: "group"
		generate: schema.#Task & {
			hermetic: false
			command:  "identity-bun"
			args: ["x", "@better-auth/cli", "generate", "--config", "./src/lib/auth.config.ts", "--output", "./src/db/schema.ts", "-y"]
		}
	}

	bun: schema.#TaskGroup & {
		type: "group"
		dev: schema.#Task & {
			hermetic: false
			command:  "identity-bun"
			args: ["x", "wrangler", "dev"]
			inputs: [
				"astro.config.mjs",
				"flake.nix",
				"flake.lock",
				"bun.lock",
				"package.json",
				"src/**",
			]
		}
	}

	migrations: schema.#TaskGroup & {
		type: "group"
		remote: schema.#Task & {
			hermetic: false
			command:  "identity-bun"
			args: ["x", "wrangler", "d1", "migrations", "apply", "identity", "--remote"]
			inputs: ["migrations/**", "wrangler.jsonc", "package.json", "flake.nix", "flake.lock"]
		}
	}

	diagnose: schema.#Task & {
		hermetic: false
		command:  "bash"
		args: ["scripts/diagnose-operator.sh"]
		inputs: ["scripts/diagnose-operator.sh", "wrangler.jsonc", "package.json", "flake.nix", "flake.lock"]
	}

	build: schema.#Task & {
		hermetic: false
		command:  "identity-bun"
		args: ["run", "build"]
		inputs: [
			"astro.config.mjs",
			"flake.nix",
			"flake.lock",
			"bun.lock",
			"package.json",
			"src/**",
		]
	}

	deploy: schema.#Task & {
		hermetic: false
		command:  "identity-bun"
		args: ["x", "wrangler", "deploy"]
		dependsOn: [_t.migrations.remote, _t.build]
		inputs: [
			"astro.config.mjs",
			"flake.nix",
			"flake.lock",
			"bun.lock",
			"migrations/**",
			"package.json",
			"src/**",
		]
	}
}
