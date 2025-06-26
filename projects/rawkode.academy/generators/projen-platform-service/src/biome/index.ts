import { Component, JsonFile, type Project } from "projen";
import {
	IndentStyle,
	QuoteStyle,
	RuleAssistPlainConfiguration,
	type Types,
	VcsClientKind,
} from "./types";

export class Biome extends Component {
	constructor(project: Project, options: Types = {}) {
		super(project);

		const defaultConfig: Types = {
			$schema: "./node_modules/@biomejs/biome/configuration_schema.json",
			vcs: {
				enabled: true,
				clientKind: VcsClientKind.Git,
				useIgnoreFile: true,
			},
			formatter: {
				enabled: true,
				useEditorconfig: true,
				indentStyle: IndentStyle.Tab,
				indentWidth: 2,
			},
			linter: {
				enabled: true,
				rules: {
					recommended: true,
				},
			},
			javascript: {
				formatter: {
					quoteStyle: QuoteStyle.Double,
				},
			},
			assist: {
				enabled: true,
				actions: {
					source: {
						organizeImports: RuleAssistPlainConfiguration.On,
					},
				},
			},
		};

		new JsonFile(project, "biome.json", {
			obj: {
				...defaultConfig,
				...options,
			},
		});
	}
}
