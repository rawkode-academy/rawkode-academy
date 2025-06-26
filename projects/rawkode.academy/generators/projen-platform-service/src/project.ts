import * as fs from "fs";
import { Liquid } from "liquidjs";
import * as path from "path";
import { Component, JsonFile, type Project, TextFile } from "projen";
import { Biome } from "./biome";
import { Bun } from "./bun";
import { Dagger } from "./dagger";
import type { PlatformServiceOptions } from "./options";
import { DataModel } from "./service/data-model";
import { ReadModel as ReadModel } from "./service/read-model";
import { WriteModelConstruct as WriteModel } from "./service/write-model";
import { TypeScriptConfig } from "./tsconfig";

export class PlatformServiceProject extends Component {
	private readonly options: Required<PlatformServiceOptions>;

	constructor(project: Project, options: PlatformServiceOptions) {
		super(project);

		this.options = {
			includeWriteModel: false,
			extendsVideo: true,
			additionalDependencies: {},
			additionalDevDependencies: {},
			schemaFields: {},
			databaseColumns: [],
			useDurableObjects: false,
			customScripts: {},
			...options,
		};

		this.createPackageJson();
		this.createConfigFiles();

		new DataModel(project);
		new ReadModel(project, {
			serviceName: this.options.serviceName,
			databaseId: this.options.databaseId,
		});

		if (this.options.includeWriteModel) {
			new WriteModel(project, {
				serviceName: this.options.serviceName,
				tableName: this.options.tableName,
				graphqlTypeName: this.options.graphqlTypeName,
				databaseId: this.options.databaseId,
			});
		}

		this.createReadme();
	}

	private createPackageJson() {
		const deps = {
			"@apollo/subgraph": "^2.10.2",
			"@graphql-tools/utils": "^10.8.6",
			"@paralleldrive/cuid2": "^2.2.2",
			"@pothos/core": "^4.6.0",
			"@pothos/plugin-directives": "^4.2.0",
			"@pothos/plugin-drizzle": "^0.8.1",
			"@pothos/plugin-federation": "^4.3.2",
			"@sindresorhus/slugify": "^2.2.1",
			"cloudflare:workers": "^0.5.0",
			"drizzle-kit": "^0.30.6",
			"drizzle-orm": "^0.38.4",
			"drizzle-zod": "^0.6.1",
			graphql: "^16.10.0",
			"graphql-scalars": "^1.24.2",
			"graphql-yoga": "^5.13.4",
			zod: "^3.24.3",
			...this.options.additionalDependencies,
		};

		const devDeps = {
			"@biomejs/biome": "^1.9.4",
			"@cloudflare/workers-types": "^4.20250426.0",
			"@types/bun": "latest",
			"@types/node": "^22.15.2",
			wrangler: "^4.13.2",
			...this.options.additionalDevDependencies,
		};

		if (this.options.includeTests) {
			devDeps["@apollo/server"] = "^4.11.4";
			devDeps["@apollo/utils.keyvaluecache"] = "^3.2.0";
			devDeps["libsql"] = "^0.4.7";
			devDeps["tsup"] = "^8.4.3";
			devDeps["vitest"] = "^2.2.5";
		}

		const scripts = {
			"publish:schema": "bun read-model/publish.ts",
			"deploy:read": "cd read-model && wrangler deploy",
			"deploy:workers": "cd read-model && wrangler deploy",
			...this.options.customScripts,
		};

		if (this.options.includeWriteModel) {
			scripts["deploy:write"] = "cd write-model && wrangler deploy";
		}

		if (this.options.includeTests) {
			scripts["test"] = "bun test";
			scripts["test:watch"] = "bun test --watch";
		}

		new JsonFile(this.project, "package.json", {
			obj: {
				name: this.options.serviceName,
				private: true,
				description: this.options.serviceDescription,
				type: "module",
				module: "read-model/main.ts",
				dependencies: deps,
				devDependencies: devDeps,
				scripts,
			},
		});
	}

	private createConfigFiles() {
		new TypeScriptConfig(this.project, {});

		new Biome(this.project);

		new Dagger(this.project, {
			name: this.options.serviceName,
		});

		new Bun(this.project, {
			test: {
				preload: ["./tests/setup.ts"],
			},
		});
	}

	private createReadme() {
		const liquid = new Liquid({
			root: path.join(__dirname, "../templates"),
			extname: ".md",
		});

		// Register custom filters for case transformations
		liquid.registerFilter("camelCase", (str: string) => this.toCamelCase(str));
		liquid.registerFilter("pascalCase", (str: string) =>
			this.toPascalCase(str),
		);

		const templatePath = path.join(__dirname, "../templates/README.md");
		const template = fs.readFileSync(templatePath, "utf-8");

		// Prepare template context
		const context = {
			serviceName: this.options.serviceName,
			serviceNameCamel: this.toCamelCase(this.options.serviceName),
			serviceNamePascal: this.toPascalCase(this.options.serviceName),
			serviceDescription: this.options.serviceDescription,
			tableName: this.options.tableName,
			graphqlTypeName: this.options.graphqlTypeName,
			includeWriteModel: this.options.includeWriteModel,
			includeTests: this.options.includeTests,
			extendsVideo: this.options.extendsVideo,
		};

		// Render template synchronously
		const readmeContent = liquid.parseAndRenderSync(template, context);

		new TextFile(this.project, "README.md", {
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
