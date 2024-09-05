import {
	dag,
	Container,
	Directory,
	object,
	func,
	argument,
} from "@dagger.io/dagger";

import { Config } from "./config";

@object()
class RawkodeAcademy {
	@func()
	config(): Config {
		return new Config();
	}

	/**
	 * Run Bun install for the entire monorepo
	 */
	@func()
	bunWorkspace(
		@argument({
			defaultPath: ".",
			ignore: [
				"*",
				"!package.json",
				"!bunfig.toml",
				"!bun.lockb",
				"!**/package.json",
				"**/node_modules/**/package.json",
				"**/dagger/**",
			],
		})
		directory: Directory,
	): Container {
		return (
			dag
				.nodeJs()
				.withBun(directory)
				.withEnvVariable(
					"BUN_INSTALL_CACHE_DIR",
					"./node_modules/.bun/global-cache",
				)
				// Bun config is broken
				// https://github.com/oven-sh/bun/issues/6423
				.withExec(["bun", "install"])
		);
	}
}
