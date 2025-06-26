import type { JSONSchemaForTheTypeScriptCompilerSConfigurationFile as Configuration } from "@schemastore/tsconfig";
import { Component, JsonFile, type Project } from "projen";

export class TypeScriptConfig extends Component {
	constructor(project: Project, options: Configuration) {
		super(project);

		const defaultOptions: Configuration = {
			compilerOptions: {
				lib: ["ESNext"],
				target: "ESNext",
				module: "NodeNext",
				moduleDetection: "force",
				jsx: "react-jsx",
				allowJs: true,
				moduleResolution: "nodenext",
				allowImportingTsExtensions: true,
				verbatimModuleSyntax: true,
				noEmit: true,
				skipLibCheck: true,
				strict: true,
				noFallthroughCasesInSwitch: true,
				forceConsistentCasingInFileNames: true,
			},
			fileNames: [],
			errors: [],
		};

		new JsonFile(project, "tsconfig.json", {
			obj: {
				...defaultOptions,
				...options,
			},
		});
	}
}
