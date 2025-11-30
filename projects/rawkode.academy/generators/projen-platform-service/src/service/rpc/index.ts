import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Liquid } from "liquidjs";
import { Component, SampleFile, TextFile } from "projen";
import type { CloudflareBindings } from "../../options";
import type { PlatformService } from "../../project";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Options {
	serviceName: string;
	bindings?: CloudflareBindings;
}

export class Rpc extends Component {
	public readonly project: PlatformService;
	private options: Options;
	private liquid: Liquid;

	constructor(project: PlatformService, options: Options) {
		super(project);

		this.project = project;
		this.options = options;

		this.liquid = new Liquid({
			root: path.join(__dirname, "../../../templates/rpc"),
		});

		// Register custom filters
		this.liquid.registerFilter("pascalCase", (str: string) =>
			this.toPascalCase(str),
		);
		this.liquid.registerFilter("camelCase", (str: string) =>
			this.toCamelCase(str),
		);

		this.createMain();
		this.createRpcService();
		this.createWranglerConfig();
	}

	private toPascalCase(str: string): string {
		return str
			.split("-")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join("");
	}

	private toCamelCase(str: string): string {
		return str
			.split("-")
			.map((word, index) =>
				index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1),
			)
			.join("");
	}

	private getTemplateContext() {
		const bindings = this.options.bindings ?? {};

		// Ensure DB binding has migrations_dir for rpc
		const d1Databases = (bindings.d1Databases ?? []).map((db) => {
			if (db.binding === "DB" && !db.migrations_dir) {
				return { ...db, migrations_dir: "../data-model/migrations" };
			}
			return db;
		});

		return {
			serviceName: this.options.serviceName,
			bindings: {
				d1Databases,
				secretStoreSecrets: bindings.secretStoreSecrets ?? [],
				kvNamespaces: bindings.kvNamespaces ?? [],
				r2Buckets: bindings.r2Buckets ?? [],
				services: bindings.services ?? [],
				workflows: bindings.workflows ?? [],
				sendEmail: bindings.sendEmail ?? [],
				ai: bindings.ai,
				vars: bindings.vars ?? {},
				crons: bindings.crons ?? [],
			},
		};
	}

	private createMain() {
		const content = this.liquid.renderFileSync(
			"main.ts",
			this.getTemplateContext(),
		);

		new TextFile(this.project, "rpc/main.ts", {
			lines: content.split("\n"),
		});
	}

	private createRpcService() {
		const content = this.liquid.renderFileSync(
			"rpc-service.ts",
			this.getTemplateContext(),
		);

		new SampleFile(this.project, "rpc/rpc-service.ts", {
			contents: content,
		});
	}

	private createWranglerConfig() {
		const content = this.liquid.renderFileSync(
			"wrangler.jsonc",
			this.getTemplateContext(),
		);

		new TextFile(this.project, "rpc/wrangler.jsonc", {
			lines: content.split("\n"),
		});
	}
}
