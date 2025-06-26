import { Component, type Project, TextFile } from "projen";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DataModel extends Component {
	public readonly project: Project;

	constructor(project: Project) {
		super(project);

		this.project = project;
		this.createDrizzleConfig();
	}

	private createDrizzleConfig() {
		const templatePath = path.join(
			__dirname,
			"../../../templates/drizzle.config.ts",
		);
		const template = fs.readFileSync(templatePath, "utf-8");

		new TextFile(this.project, "drizzle.config.ts", {
			lines: template.split("\n"),
		});
	}
}
