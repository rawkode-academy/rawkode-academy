import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Liquid } from "liquidjs";
import { JsonFile, Project, TextFile } from "projen";
import { Biome } from "./biome";
import { Bun } from "./bun";
import { Dagger } from "./dagger";
import type { PlatformServiceOptions } from "./options";
import { DataModel } from "./service/data-model";
import { ReadModel } from "./service/read-model";
import { Rpc } from "./service/rpc";
import { WriteModel } from "./service/write-model";
import { TypeScriptConfig } from "./tsconfig";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PlatformService extends Project {
	private readonly options: Omit<
		Required<PlatformServiceOptions>,
		"bindings"
	> & { bindings?: PlatformServiceOptions["bindings"] };
	private readonly dependencies: Record<string, string>;
	private readonly devDependencies: Record<string, string>;

	constructor(options: PlatformServiceOptions) {
		super({
			name: options.serviceName,
			outdir: ".",
			commitGenerated: false,
		});

		this.tasks.tryFind("default")?.reset("bun run .projenrc.ts");

		this.options = {
			includeDataModel: true,
			includeReadModel: true,
			includeWriteModel: false,
			includeRpc: false,
			additionalDependencies: {},
			additionalDevDependencies: {},
			...options,
		};

		// Validation: D1 database with binding "DB" required if any data-using model is enabled
		const needsDatabase =
			this.options.includeDataModel ||
			this.options.includeReadModel ||
			this.options.includeWriteModel;

		const hasDbBinding = this.options.bindings?.d1Databases?.some(
			(db) => db.binding === "DB",
		);

		if (needsDatabase && !hasDbBinding) {
			throw new Error(
				'bindings.d1Databases must include a database with binding "DB" when includeDataModel, includeReadModel, or includeWriteModel is true',
			);
		}

		// Automatically inject ANALYTICS service binding for all services
		const analyticsBinding = {
			binding: "ANALYTICS",
			service: "platform-analytics-rpc",
		};

		if (this.options.bindings) {
			const existingServices = this.options.bindings.services ?? [];
			const hasAnalytics = existingServices.some(
				(s) => s.binding === "ANALYTICS",
			);
			if (!hasAnalytics) {
				this.options.bindings = {
					...this.options.bindings,
					services: [...existingServices, analyticsBinding],
				};
			}
		} else {
			this.options.bindings = {
				services: [analyticsBinding],
			};
		}

		// Initialize dependencies conditionally
		this.dependencies = {};

		// Add data model dependencies only if data model is included
		if (this.options.includeDataModel) {
			Object.assign(this.dependencies, {
				"@paralleldrive/cuid2": "^2.2.2",
				"@sindresorhus/slugify": "^2.2.1",
				"drizzle-kit": "^0.30.6",
				"drizzle-orm": "^0.38.4",
				"drizzle-zod": "^0.6.1",
				zod: "^3.24.3",
			});
		}

		// Add GraphQL dependencies if read model is included
		if (this.options.includeReadModel) {
			Object.assign(this.dependencies, {
				"@apollo/subgraph": "^2.10.2",
				"@graphql-tools/utils": "^10.8.6",
				"@pothos/core": "^4.6.0",
				"@pothos/plugin-directives": "^4.2.0",
				"@pothos/plugin-drizzle": "^0.8.1",
				"@pothos/plugin-federation": "^4.3.2",
				graphql: "^16.10.0",
				"graphql-scalars": "^1.24.2",
				"graphql-yoga": "^5.13.4",
			});
		}

		// Add additional dependencies last to allow overrides
		Object.assign(this.dependencies, this.options.additionalDependencies);

		this.devDependencies = {
			"@biomejs/biome": "^1.9.4",
			"@cloudflare/workers-types": "^4.20250426.0",
			"@types/bun": "latest",
			"@types/node": "^22.15.2",
			vitest: "^1.2.17",
			wrangler: "^4.13.2",
			...this.options.additionalDevDependencies,
		};

		// Only create DataModel if includeDataModel is true
		if (this.options.includeDataModel) {
			new DataModel(this);
		}

		if (this.options.includeReadModel) {
			new ReadModel(this, {
				serviceName: this.options.serviceName,
				bindings: this.options.bindings,
			});
		}

		if (this.options.includeWriteModel) {
			new WriteModel(this, {
				workflows: [],
				bindings: this.options.bindings,
			});
		}

		if (this.options.includeRpc) {
			new Rpc(this, {
				serviceName: this.options.serviceName,
				bindings: this.options.bindings,
			});
		}

		this.createReadme();
		this.createPackageJson();
		this.createConfigFiles();
	}

	/**
	 * Register additional dependencies
	 */
	public addDependency(name: string, version: string): void {
		this.dependencies[name] = version;
	}

	/**
	 * Register multiple dependencies at once
	 */
	public addDependencies(deps: Record<string, string>): void {
		Object.assign(this.dependencies, deps);
	}

	/**
	 * Register additional dev dependencies
	 */
	public addDevDependency(name: string, version: string): void {
		this.devDependencies[name] = version;
	}

	/**
	 * Register multiple dev dependencies at once
	 */
	public addDevDependencies(deps: Record<string, string>): void {
		Object.assign(this.devDependencies, deps);
	}

	private createPackageJson() {
		// Sort dependencies alphabetically
		const sortedDeps = Object.keys(this.dependencies)
			.sort()
			.reduce(
				(acc, key) => {
					acc[key] = this.dependencies[key];
					return acc;
				},
				{} as Record<string, string>,
			);

		const sortedDevDeps = Object.keys(this.devDependencies)
			.sort()
			.reduce(
				(acc, key) => {
					acc[key] = this.devDependencies[key];
					return acc;
				},
				{} as Record<string, string>,
			);

		new JsonFile(this, "package.json", {
			obj: {
				name: this.options.serviceName,
				private: true,
				type: "module",
				dependencies: sortedDeps,
				devDependencies: sortedDevDeps,
			},
		});
	}

	private createConfigFiles() {
		new TypeScriptConfig(this, {});

		new Biome(this);

		new Bun(this);
	}

	private createReadme() {
		const templatesDir = path.join(__dirname, "../templates");

		const liquid = new Liquid({
			root: templatesDir,
			extname: ".md",
		});

		liquid.registerFilter("camelCase", (str: string) => this.toCamelCase(str));
		liquid.registerFilter("pascalCase", (str: string) =>
			this.toPascalCase(str),
		);

		const context = {
			serviceName: this.options.serviceName,
			serviceNameCamel: this.toCamelCase(this.options.serviceName),
			serviceNamePascal: this.toPascalCase(this.options.serviceName),
			includeDataModel: this.options.includeDataModel,
			includeReadModel: this.options.includeReadModel,
			includeWriteModel: this.options.includeWriteModel,
		};

		const readmeContent = liquid.renderFileSync("README", context);

		new TextFile(this, "README.md", {
			lines: readmeContent.split("\n"),
		});
	}

	private toCamelCase(str: string): string {
		return str
			.split("-")
			.map((word, index) =>
				index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1),
			)
			.join("");
	}

	private toPascalCase(str: string): string {
		return str
			.split("-")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join("");
	}
}
