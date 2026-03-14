package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-news"

let _t = tasks

runtime: schema.#ToolsRuntime & {
	flakes: {
		nixpkgs: "github:NixOS/nixpkgs/nixos-25.05"
	}
	tools: {
		node: {
			version: "22.12.0"
			source: schema.#Nix & {
				flake:   "nixpkgs"
				package: "nodejs_22"
			}
		}
	}
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
			"astro.config.ts",
			"package.json",
			"public/**",
			"src/**",
			"wrangler.jsonc",
		]
	}

	build: {
		command: "bun"
		args: ["run", "build"]

		inputs: [
			"astro.config.ts",
			"package.json",
			"public/**",
			"src/**",
			"wrangler.jsonc",
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
