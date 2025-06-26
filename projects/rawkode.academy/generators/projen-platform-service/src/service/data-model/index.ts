import { Component, Project, TextFile } from "projen";
import fs from "node:fs";

export class DataModel extends Component {
	constructor(project: Project) {
		super(project);
		this.createDrizzleConfig();
	}

	private createDrizzleConfig() {
		const templatePath = "templates/data-model/drizzle.config.ts";
		const template = fs.readFileSync(templatePath, "utf-8");

		new TextFile(this.project, "data-model/drizzle.config.ts", {
			lines: template.split("\n"),
		});
	}
}
