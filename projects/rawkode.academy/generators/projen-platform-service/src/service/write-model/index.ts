import { Liquid } from "liquidjs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Component, type Project, TextFile } from "projen";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WorkflowDefinition {
	name: string;
	binding: string;
	className: string;
	scriptName: string;
}

interface Options {
	databaseId: string;
	workflows: WorkflowDefinition[];
}

export class WriteModel extends Component {
	public readonly project: Project;
	private options: Options;
	private liquid: Liquid;

	constructor(project: Project, options: Options) {
		super(project);

		this.project = project;
		this.options = options;

		this.liquid = new Liquid({
			root: path.join(__dirname, "../../../templates/write-model"),
		});

		// Create files during construction
		this.createWranglerConfig();
	}

	private createWranglerConfig() {
		const content = this.liquid.renderFileSync("wrangler.jsonc", {
			serviceName: this.project.name,
			databaseId: this.options.databaseId,
			workflows: this.options.workflows,
		});

		new TextFile(this.project, "write-model/wrangler.jsonc", {
			lines: content.split("\n"),
		});
	}
}
