import { Component, Project, TextFile } from "projen";
import * as path from "path";
import * as fs from "fs";
import { Liquid } from "liquidjs";

interface Options {
	serviceName: string;
	databaseId: string;
}

export class ReadModel extends Component {
	private liquid: Liquid;

	constructor(project: Project, options: Options) {
		super(project);

		this.liquid = new Liquid({
			root: path.join(__dirname, "../../../templates/read-model"),
		});

		project.addTask("synth:read-model", {
			exec: "echo 'Synthesizing read-model templates'",
		});

		this.synthesize(options);
	}

	private synthesize(options: Options) {
		Promise.all([
			this.createApi(options),
			this.createSchemaWriter(options),
			this.createWranglerConfig(options),
		]).catch((error) => {
			throw new Error(`Failed to synthesize read-model templates: ${error}`);
		});
	}

	private async createApi(options: Options) {
		const content = await this.liquid.renderFile("main.ts", options);

		new TextFile(this.project, "read-model/main.ts", {
			lines: content.split("\n"),
		});
	}

	private async createSchemaWriter(options: Options) {
		const content = await this.liquid.renderFile("publish.ts", options);

		new TextFile(this.project, "read-model/publish.ts", {
			lines: content.split("\n"),
		});
	}

	private async createWranglerConfig(options: Options) {
		const content = await this.liquid.renderFile("wrangler.jsonc", options);

		new TextFile(this.project, "read-model/wrangler.jsonc", {
			lines: content.split("\n"),
		});
	}
}
