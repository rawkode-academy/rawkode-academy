import { Component, JsonFile, type Project } from "projen";

export interface DaggerConfigOptions {
	name?: string;
	engineVersion?: string;
	sdk?: string;
}

export class Dagger extends Component {
	constructor(project: Project, options: DaggerConfigOptions = {}) {
		super(project);

		new JsonFile(project, "dagger.json", {
			obj: {
				name: options.name || project.name,
				engineVersion: options.engineVersion || "v0.8.11",
				...(options.sdk && { sdk: options.sdk }),
			},
		});
	}
}
