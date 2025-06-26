import { Component, Project, TextFile, JsonFile } from "projen";
import * as path from "path";
import * as fs from "fs";
import { PlatformServiceOptions } from "../../options";
import { Liquid } from "liquidjs";

export interface WorkflowDefinition {
	name: string;
	binding: string;
	className: string;
	scriptName: string;
}

export interface WriteModelConstructOptions {
	serviceName: string;
	tableName: string;
	graphqlTypeName: string;
	databaseId: string;
	workflows: WorkflowDefinition[];
}

export class WriteModelConstruct extends Component {
	private liquid: Liquid;

	constructor(project: Project, options: WriteModelConstructOptions) {
		super(project);

		this.liquid = new Liquid({
			root: path.join(__dirname, "../../../templates/write-model"),
		});

		project.addTask("synth:write-model", {
			exec: "echo 'Synthesizing write-model templates'",
		});

		this.synthesize(options);
	}

	private synthesize(options: WriteModelConstructOptions) {
		Promise.all([
			this.createWorkflow(options),
			this.createMain(options),
			this.createWorkerConfiguration(),
			this.createWranglerConfig(options),
		]).catch((error) => {
			throw new Error(`Failed to synthesize write-model templates: ${error}`);
		});
	}

	private async createWorkflow(options: WriteModelConstructOptions) {
		const content = await this.liquid.renderFile("workflow.ts", {
			graphqlTypeName: options.graphqlTypeName,
			tableName: options.tableName,
		});

		new TextFile(this.project, "write-model/workflow.ts", {
			lines: content.split("\n"),
		});
	}

	private async createMain(options: WriteModelConstructOptions) {
		// For backward compatibility, use the first workflow if it exists
		const defaultWorkflowBinding = options.workflows.length > 0 
			? options.workflows[0].binding 
			: options.serviceName.toUpperCase().replace(/-/g, "_") + "_WORKFLOW";

		const content = await this.liquid.renderFile("main.ts", {
			graphqlTypeName: options.graphqlTypeName,
			workflowBinding: defaultWorkflowBinding,
			serviceName: options.serviceName,
			workflows: options.workflows,
		});

		new TextFile(this.project, "write-model/main.ts", {
			lines: content.split("\n"),
		});
	}

	private async createWorkerConfiguration() {
		const content = await this.liquid.renderFile("worker-configuration.d.ts", {});

		new TextFile(this.project, "write-model/worker-configuration.d.ts", {
			lines: content.split("\n"),
		});
	}

	private async createWranglerConfig(options: WriteModelConstructOptions) {
		const content = await this.liquid.renderFile("wrangler.jsonc", {
			serviceName: options.serviceName,
			databaseId: options.databaseId,
			workflows: options.workflows,
		});

		new TextFile(this.project, "write-model/wrangler.jsonc", {
			lines: content.split("\n"),
		});
	}
}
