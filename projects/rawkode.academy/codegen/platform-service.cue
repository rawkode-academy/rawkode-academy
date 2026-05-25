package codegen

import (
	"encoding/json"
	"list"
	"strings"
	"github.com/cuenv/cuenv/schema"
	gen "github.com/cuenv/cuenv/schema/codegen"
)

// #PlatformService generates a Cloudflare Workers service with GraphQL Federation
#PlatformService: {
	// Service name in kebab-case (e.g., "user-profiles")
	serviceName!: string & =~"^[a-z][a-z0-9-]*$"

	// Prefix for Cloudflare Worker names (default: "platform")
	servicePrefix: string | *"platform"

	// Feature toggles
	includeDataModel:  bool | *true
	includeReadModel:  bool | *true
	includeWriteModel: bool | *false
	includeHttp:       bool | *false

	// Cloudflare bindings
	bindings: #CloudflareBindings

	// Additional npm dependencies
	additionalDependencies: {[string]: string} | *{}
	additionalDevDependencies: {[string]: string} | *{}

	// Computed values
	_nameParts: strings.Split(serviceName, "-")
	_pascalName: strings.Join([for p in _nameParts {strings.ToTitle(p)}], "")

	// Auto-inject ANALYTICS service binding
	_analyticsBinding: #ServiceBinding & {
		binding: "ANALYTICS"
		service: "rawkode-tools-observability-collector"
	}
	_allServices: list.Concat([[_analyticsBinding], bindings.services])
	_bindings: {
		d1Databases:        bindings.d1Databases
		secretStoreSecrets: bindings.secretStoreSecrets
		kvNamespaces:       bindings.kvNamespaces
		r2Buckets:          bindings.r2Buckets
		workflows:          bindings.workflows
		sendEmail:          bindings.sendEmail
		routes:             bindings.routes
		vars:               bindings.vars
		crons:              bindings.crons
		if bindings.ai != _|_ {
			ai: bindings.ai
		}
		services: _allServices
	}

	// Generate the codegen configuration
	codegen: schema.#Codegen & {
		context: {
			"serviceName":   serviceName
			"servicePrefix": servicePrefix
			"pascalName":    _pascalName
		}

		files: {
			// Core config files - always managed
			"package.json": gen.#JSONFile & {
				mode:    "managed"
				content: json.Indent(json.Marshal(_packageJson), "", "  ")
			}

			"tsconfig.json": gen.#JSONFile & {
				mode:    "managed"
				content: json.Indent(json.Marshal(_tsconfigJson), "", "  ")
			}

			"biome.json": gen.#JSONFile & {
				mode:    "managed"
				content: json.Indent(json.Marshal(_biomeJson), "", "  ")
			}

			"README.md": gen.#MarkdownFile & {
				mode:    "managed"
				content: _readme
			}

			// Data model
			if includeDataModel {
				"drizzle.config.ts": gen.#TypeScriptFile & {
					mode:     "managed"
					language: "typescript"
					content: """
						import type { Config } from "drizzle-kit";

						export default {
							schema: "./data-model/schema.ts",
							out: "./data-model/migrations",
							dialect: "sqlite",
							driver: "d1-http",
						} satisfies Config;
						"""
				}
			}

			// Read model
			if includeReadModel {
				"read-model/wrangler.jsonc": gen.#JSONCFile & {
					mode:    "managed"
					content: json.Indent(json.Marshal(_readModelWrangler), "", "\t")
				}

				"read-model/main.ts": gen.#TypeScriptFile & {
					mode:    "managed"
					content: _readModelMainTs
				}

				"read-model/publish.ts": gen.#TypeScriptFile & {
					mode: "managed"
					content: """
						import { writeFileSync } from "node:fs";
						import { printSubgraphSchema } from "@apollo/subgraph";
						import { lexicographicSortSchema } from "graphql";
						import { getSchema } from "./schema";

						const mockEnv = {} as Parameters<typeof getSchema>[0];
						const sdl = printSubgraphSchema(lexicographicSortSchema(getSchema(mockEnv)));
						writeFileSync("./read-model/schema.gql", sdl);
						console.log("Schema written to ./read-model/schema.gql");
						"""
				}
			}

			// Write model
			if includeWriteModel {
				"write-model/wrangler.jsonc": gen.#JSONCFile & {
					mode:    "managed"
					content: json.Indent(json.Marshal(_writeModelWrangler), "", "\t")
				}

				"write-model/main.ts": gen.#TypeScriptFile & {
					mode:    "scaffold"
					content: _writeModelMainTs
				}
			}

			// HTTP service
			if includeHttp {
				"http/wrangler.jsonc": gen.#JSONCFile & {
					mode:    "managed"
					content: json.Indent(json.Marshal(_httpWrangler), "", "\t")
				}

				"http/main.ts": gen.#TypeScriptFile & {
					mode:    "scaffold"
					content: _httpMainTs
				}

				"http/http-service.ts": gen.#TypeScriptFile & {
					mode:    "scaffold"
					content: _httpServiceTs
				}
			}
		}
	}

	let _t = tasks

	// CI pipeline with workflow_dispatch enabled. The deploy tasks depend on
	// `migrate` by name (when present), so migrations apply before any deploy.
	ci: pipelines: {
		default: {
			environment: "production"
			when: {
				branch: ["main"]
				defaultBranch: true
				manual:        true
			}
			tasks: [
				if _hasMigrations {schema.#TaskSequence & [_t.migrate, _t.deploy]},
				if !_hasMigrations {_t.deploy},
			]
		}
	}

	// A service owns migrations when it has a data-model, a read-model, and a
	// "DB" D1 binding (migrations_dir is auto-injected for DB on the read-model).
	_dbBindings: [for db in _bindings.d1Databases if db.binding == "DB" {db}]
	_hasMigrations: includeDataModel && includeReadModel && len(_dbBindings) > 0

	// Auto-generated deploy tasks based on enabled features. Services that own a
	// D1 schema also get a `migrate` task, ordered before deploy in the pipeline.
	// `hermetic: false` so tasks inherit the activated devenv-runtime PATH that
	// provides `bun` (cuenv v0.42.0 hermetic spawns drop it -> ENOENT on `bun`).
	// `inputs` drive cuenv change-detection: without them the deploy/migrate
	// tasks are never "affected" and CI skips them. data-model/** is shared by
	// the read and write workers (and gates migrations).
	tasks: {
		if _hasMigrations {
			migrate: schema.#Task & {
				hermetic: false
				dir: from: "caller"
				command: "bun"
				args: [
					"x", "wrangler", "d1", "migrations", "apply", "DB",
					"--remote", "--config", "./read-model/wrangler.jsonc",
				]
				inputs: ["data-model", "read-model/wrangler.jsonc"]
			}
		}

		deploy: {
			type: "group"

			if includeReadModel {
				read: schema.#Task & {
					hermetic: false
					dir: from: "caller"
					command: "bun"
					args: ["x", "wrangler", "deploy", "--config", "./read-model/wrangler.jsonc"]
					inputs: ["read-model", "data-model", "package.json"]
				}
			}
			if includeWriteModel {
				write: schema.#Task & {
					hermetic: false
					dir: from: "caller"
					command: "bun"
					args: ["x", "wrangler", "deploy", "--config", "./write-model/wrangler.jsonc"]
					inputs: ["write-model", "data-model", "package.json"]
				}
			}
			if includeHttp {
				http: schema.#Task & {
					hermetic: false
					dir: from: "caller"
					command: "bun"
					args: ["x", "wrangler", "deploy", "--config", "./http/wrangler.jsonc"]
					inputs: ["http", "data-model", "package.json"]
				}
			}
		}
	}

	// ========================================================================
	// Package.json
	// ========================================================================

	_packageJson: {
		name:    serviceName
		private: true
		type:    "module"
		dependencies: {
			if includeDataModel {
				"@paralleldrive/cuid2":  "^2.2.2"
				"@sindresorhus/slugify": "^2.2.1"
				"drizzle-kit":           "^0.30.6"
				"drizzle-orm":           "^0.38.4"
				"drizzle-zod":           "^0.6.1"
				"zod":                   "^3.24.3"
			}
			if includeReadModel {
				"@apollo/subgraph":          "^2.10.2"
				"@graphql-tools/utils":      "^10.8.6"
				"@pothos/core":              "^4.6.0"
				"@pothos/plugin-directives": "^4.2.0"
				"@pothos/plugin-drizzle":    "^0.8.1"
				"@pothos/plugin-federation": "^4.3.2"
				"graphql":                   "^16.10.0"
				"graphql-scalars":           "^1.24.2"
				"graphql-yoga":              "^5.13.4"
			}
			if includeWriteModel {
				"hono": "^4.8.3"
			}
			for k, v in additionalDependencies {
				"\(k)": v
			}
		}
		devDependencies: {
			"@biomejs/biome":            "^1.9.4"
			"@cloudflare/workers-types": "^4.20250426.0"
			"@types/bun":                "latest"
			"@types/node":               "^22.15.2"
			"vitest":                    "^1.2.17"
			"wrangler":                  "^4.13.2"
			for k, v in additionalDevDependencies {
				"\(k)": v
			}
		}
	}

	// ========================================================================
	// Config files
	// ========================================================================

	_tsconfigJson: {
		compilerOptions: {
			lib: ["ESNext"]
			target:                           "ESNext"
			module:                           "NodeNext"
			moduleDetection:                  "force"
			jsx:                              "react-jsx"
			allowJs:                          true
			moduleResolution:                 "nodenext"
			allowImportingTsExtensions:       true
			verbatimModuleSyntax:             true
			noEmit:                           true
			skipLibCheck:                     true
			strict:                           true
			noFallthroughCasesInSwitch:       true
			forceConsistentCasingInFileNames: true
		}
		fileNames: []
		errors: []
	}

	_biomeJson: {
		"$schema": "./node_modules/@biomejs/biome/configuration_schema.json"
		vcs: {
			enabled:       true
			clientKind:    "git"
			useIgnoreFile: true
		}
		formatter: {
			enabled:         true
			useEditorconfig: true
			indentStyle:     "tab"
			indentWidth:     2
		}
		linter: {
			enabled: true
			rules: recommended: true
		}
		javascript: formatter: quoteStyle: "double"
		assist: {
			enabled: true
			actions: source: organizeImports: "on"
		}
	}

	// List of enabled components for README
	_components: strings.Join([
		if includeDataModel {"data-model"},
		if includeReadModel {"read-model"},
		if includeWriteModel {"write-model"},
		if includeHttp {"http"},
	], ", ")

	_readme: """
		# \(serviceName)

		A platform service for the Rawkode Academy.

		## Components

		This service includes: \(_components)

		## Development

		```bash
		# Install dependencies
		bun install

		# Run development server (read-model)
		bunx wrangler dev --config ./read-model/wrangler.jsonc

		# Generate database migrations
		bunx drizzle-kit generate

		# Apply migrations
		bunx wrangler d1 migrations apply DB --config ./read-model/wrangler.jsonc
		```

		## Deployment

		```bash
		bunx wrangler deploy --config ./read-model/wrangler.jsonc
		```
		"""

	// ========================================================================
	// Wrangler configs
	// ========================================================================

	_baseWrangler: {
		"$schema":          "./node_modules/wrangler/config-schema.json"
		compatibility_date: "2025-04-05"
		compatibility_flags: ["nodejs_compat"]
		keep_vars:   false
		minify:      true
		workers_dev: true
		placement: mode: "smart"
		observability: {
			enabled:            true
			head_sampling_rate: 1
			traces: {
				enabled: true
				destinations: ["grafana-traces"]
			}
			logs: {
				enabled:            true
				invocation_logs:    true
				head_sampling_rate: 1
				destinations: ["grafana-logs"]
			}
		}

		if len(_bindings.d1Databases) > 0 {
			d1_databases: [for db in _bindings.d1Databases {
				binding:       db.binding
				database_name: db.databaseName
				database_id:   db.databaseId
				if db.migrationsDir != _|_ {
					migrations_dir: db.migrationsDir
				}
			}]
		}

		if len(_bindings.kvNamespaces) > 0 {
			kv_namespaces: [for kv in _bindings.kvNamespaces {
				binding: kv.binding
				id:      kv.id
			}]
		}

		if len(_bindings.r2Buckets) > 0 {
			r2_buckets: [for bucket in _bindings.r2Buckets {
				binding:     bucket.binding
				bucket_name: bucket.bucketName
			}]
		}

		if len(_bindings.services) > 0 {
			services: [for svc in _bindings.services {
				binding: svc.binding
				service: svc.service
			}]
		}

		// Workflows are intentionally NOT bound in the shared base. A Cloudflare
		// Workflow can only be owned by a single worker, and in our CQRS layout
		// the write-model owns and invokes them (read models never mutate). The
		// binding is emitted only on _writeModelWrangler below.

		if len(_bindings.routes) > 0 {
			routes: [for route in _bindings.routes {
				pattern: route.pattern
				if route.customDomain != _|_ {
					custom_domain: route.customDomain
				}
				if route.zoneName != _|_ {
					zone_name: route.zoneName
				}
			}]
		}

		if len(_bindings.sendEmail) > 0 {
			send_email: [for email in _bindings.sendEmail {
				name: email.name
				if email.destinationAddress != _|_ {
					destination_address: email.destinationAddress
				}
				if email.allowedDestinationAddresses != _|_ {
					allowed_destination_addresses: email.allowedDestinationAddresses
				}
			}]
		}

		if len(_bindings.secretStoreSecrets) > 0 {
			secrets_store_secrets: [for secret in _bindings.secretStoreSecrets {
				binding:     secret.binding
				store_id:    secret.storeId
				secret_name: secret.secretName
			}]
		}

		if len(_bindings.crons) > 0 {
			triggers: {
				crons: _bindings.crons
			}
		}
	}

	// D1 databases with auto-injected migrations_dir for read-model/http
	_d1WithMigrations: [for db in _bindings.d1Databases {
		binding:       db.binding
		database_name: db.databaseName
		database_id:   db.databaseId
		// Auto-inject migrations_dir for DB binding
		if db.binding == "DB" {
			migrations_dir: db.migrationsDir | *"../data-model/migrations"
		}
		if db.binding != "DB" && db.migrationsDir != _|_ {
			migrations_dir: db.migrationsDir
		}
	}]

	_readModelWrangler: _baseWrangler & {
		name: "\(servicePrefix)-\(serviceName)-read-model"
		main: "./main.ts"
		if len(_d1WithMigrations) > 0 {
			d1_databases: _d1WithMigrations
		}
	}

	// The write-model is the sole owner of any Workflows. Read models never
	// mutate, so they neither bind nor export workflow classes.
	_writeModelWrangler: _baseWrangler & {
		name: "\(servicePrefix)-\(serviceName)-write-model"
		main: "./main.ts"
		if len(_bindings.workflows) > 0 {
			workflows: [for wf in _bindings.workflows {
				binding:    wf.binding
				name:       wf.name
				class_name: wf.className
				if wf.scriptName != _|_ {
					script_name: wf.scriptName
				}
			}]
		}
	}

	_httpWrangler: _baseWrangler & {
		name: "\(servicePrefix)-\(serviceName)-rpc"
		main: "main.ts"
		if len(_d1WithMigrations) > 0 {
			d1_databases: _d1WithMigrations
		}
	}

	// ========================================================================
	// TypeScript files
	// ========================================================================

	// Base Env bindings shared by every worker. Workflows are deliberately
	// excluded here: only the write-model owns them (see _writeEnvInterface).
	_envBindings: [
		for db in _bindings.d1Databases {"\(db.binding): D1Database;"},
		for secret in _bindings.secretStoreSecrets {"\(secret.binding): SecretsStoreSecret;"},
		for kv in _bindings.kvNamespaces {"\(kv.binding): KVNamespace;"},
		for bucket in _bindings.r2Buckets {"\(bucket.binding): R2Bucket;"},
		for svc in _bindings.services {"\(svc.binding): Service;"},
		if _bindings.ai != _|_ {"\(_bindings.ai.binding): Ai;"},
		for k, _ in _bindings.vars {"\(k): string;"},
	]

	// Env for read-model/http: no workflow bindings. list.Concat materializes the
	// comprehension list into a concrete [...string]; passing _envBindings straight
	// to strings.Join leaves it non-concrete (vars is an open struct).
	_envInterface: strings.Join(list.Concat([_envBindings]), "\n\t")

	// Env for the write-model: base bindings plus the Workflow handles it owns.
	_workflowEnvBindings: [for wf in _bindings.workflows {"\(wf.binding): Workflow;"}]
	_writeEnvInterface:   strings.Join(list.Concat([_envBindings, _workflowEnvBindings]), "\n\t")

	// Workflow class re-exports for write-model/main.ts. The owning worker must
	// export each Workflow class referenced by its wrangler `class_name`.
	_writeWorkflowExports: strings.Join([
		for wf in _bindings.workflows {"export { \(wf.className) } from \"./\(wf.binding)\";"},
	], "\n")

	_readModelMainTs: """
		import { createYoga } from "graphql-yoga";
		import { getSchema } from "./schema";

		export interface Env {
			\(_envInterface)
		}

		export default {
			fetch(request: Request, env: Env, ctx: ExecutionContext) {
				const yoga = createYoga({
					schema: getSchema(env),
					graphqlEndpoint: "/",
					context: ({ request }) => ({
						userId: request.headers.get("X-Gateway-User-Id"),
					}),
				});

				return yoga.fetch(request, env, ctx);
			},
		};
		"""

	_httpMainTs: """
		import { \(_pascalName) } from "./http-service.js";

		export interface Env {
			\(_envInterface)
		}

		export default \(_pascalName);
		"""

	_httpServiceTs: """
		import { WorkerEntrypoint } from "cloudflare:workers";
		import type { Env } from "./main.js";

		export class \(_pascalName) extends WorkerEntrypoint<Env> {
			async fetch(request: Request): Promise<Response> {
				if (new URL(request.url).pathname === "/health") {
					return new Response("ok", { headers: { "Content-Type": "text/plain" } });
				}

				return new Response("Not Found", { status: 404 });
			}

			// Add your HTTP methods here
		}
		"""

	_writeModelMainTs: """
		import { WorkerEntrypoint } from "cloudflare:workers";
		\(_writeWorkflowExports)

		export interface Env {
			\(_writeEnvInterface)
		}

		export class \(_pascalName)WriteModel extends WorkerEntrypoint<Env> {
			async fetch(request: Request): Promise<Response> {
				return new Response("Not Found", { status: 404 });
			}

			// Add your workflow handlers here
		}

		export default \(_pascalName)WriteModel;
		"""
}

// ============================================================================
// Cloudflare Bindings Types
// ============================================================================

#CloudflareBindings: {
	d1Databases: [...#D1DatabaseBinding] | *[]
	secretStoreSecrets: [...#SecretStoreSecretBinding] | *[]
	kvNamespaces: [...#KVNamespaceBinding] | *[]
	r2Buckets: [...#R2BucketBinding] | *[]
	services: [...#ServiceBinding] | *[]
	workflows: [...#WorkflowBinding] | *[]
	sendEmail: [...#SendEmailBinding] | *[]
	routes: [...#RouteBinding] | *[]
	ai?: #AiBinding
	vars: {[string]: string} | *{}
	crons: [...string] | *[]
}

#D1DatabaseBinding: {
	binding!:       string
	databaseName!:  string
	databaseId!:    string
	migrationsDir?: string
}

#SecretStoreSecretBinding: {
	binding!:    string
	storeId!:    string
	secretName!: string
}

#KVNamespaceBinding: {
	binding!: string
	id!:      string
}

#R2BucketBinding: {
	binding!:    string
	bucketName!: string
}

#ServiceBinding: {
	binding!: string
	service!: string
}

#WorkflowBinding: {
	binding!:    string
	name!:       string
	className!:  string
	scriptName?: string
}

#SendEmailBinding: {
	name!:               string
	destinationAddress?: string
	allowedDestinationAddresses?: [...string]
}

#RouteBinding: {
	pattern!:      string
	customDomain?: bool
	zoneName?:     string
}

#AiBinding: {
	binding!: string
}
