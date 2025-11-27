import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Liquid } from "liquidjs";
import { Component, TextFile } from "projen";
import type { CloudflareBindings } from "../../options";
import type { PlatformService } from "../../project";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WorkflowDefinition {
	name: string;
	binding: string;
	className: string;
	scriptName: string;
}

interface Options {
	workflows: WorkflowDefinition[];
	bindings?: CloudflareBindings;
}

export class WriteModel extends Component {
	public readonly project: PlatformService;
	private options: Options;
	private liquid: Liquid;

	constructor(project: PlatformService, options: Options) {
		super(project);

		this.project = project;
		this.options = options;

		this.liquid = new Liquid({
			root: path.join(__dirname, "../../../templates/write-model"),
		});

		this.createWranglerConfig();

		console.log("adding dep");
		this.project.addDependency("hono", "^4.8.3");
	}

	private getTemplateContext() {
		const bindings = this.options.bindings ?? {};

		// Merge legacy workflows with bindings.workflows
		const workflows = [
			...this.options.workflows.map((w) => ({
				binding: w.binding,
				name: w.name,
				class_name: w.className,
				script_name: w.scriptName,
			})),
			...(bindings.workflows ?? []),
		];

		return {
			serviceName: this.project.name,
			bindings: {
				d1Databases: bindings.d1Databases ?? [],
				secretStoreSecrets: bindings.secretStoreSecrets ?? [],
				kvNamespaces: bindings.kvNamespaces ?? [],
				r2Buckets: bindings.r2Buckets ?? [],
				services: bindings.services ?? [],
				workflows,
				ai: bindings.ai,
				vars: bindings.vars ?? {},
				crons: bindings.crons ?? [],
			},
		};
	}

	private createWranglerConfig() {
		const content = this.liquid.renderFileSync(
			"wrangler.jsonc",
			this.getTemplateContext(),
		);

		new TextFile(this.project, "write-model/wrangler.jsonc", {
			lines: content.split("\n"),
		});
	}
}
