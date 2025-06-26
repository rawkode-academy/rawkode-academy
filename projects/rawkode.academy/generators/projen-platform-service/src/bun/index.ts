import { Component, type Project, TextFile } from "projen";

export interface BunConfigOptions {
	test?: {
		preload?: string[];
		coverageThreshold?: number;
		coverageDir?: string;
	};
	install?: {
		lockfile?: {
			save?: boolean;
		};
	};
}

export class Bun extends Component {
	constructor(project: Project, options: BunConfigOptions = {}) {
		super(project);

		const lines: string[] = [];

		if (options.test) {
			lines.push("[test]");
			if (options.test.preload && options.test.preload.length > 0) {
				lines.push(
					`preload = [${options.test.preload.map((p) => `"${p}"`).join(", ")}]`,
				);
			}
			if (options.test.coverageThreshold !== undefined) {
				lines.push(`coverageThreshold = ${options.test.coverageThreshold}`);
			}
			if (options.test.coverageDir) {
				lines.push(`coverageDir = "${options.test.coverageDir}"`);
			}
			lines.push("");
		}

		if (options.install) {
			lines.push("[install]");
			if (options.install.lockfile) {
				lines.push("[install.lockfile]");
				if (options.install.lockfile.save !== undefined) {
					lines.push(`save = ${options.install.lockfile.save}`);
				}
			}
		}

		// Only create the file if there are configurations to write
		if (lines.length > 0) {
			new TextFile(project, "bunfig.toml", { lines });
		}
	}
}
