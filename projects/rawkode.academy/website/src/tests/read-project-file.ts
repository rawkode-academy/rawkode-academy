import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function createProjectFileReader(
	moduleUrl: string,
	projectRootRelativePath: string,
): (relativePath: string) => string {
	const testDir = dirname(fileURLToPath(moduleUrl));
	const projectRoot = resolve(testDir, projectRootRelativePath);

	return (relativePath: string): string =>
		readFileSync(resolve(projectRoot, relativePath), "utf-8");
}
