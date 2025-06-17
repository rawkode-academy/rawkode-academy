import { type Directory, argument, dag, func, object } from "@dagger.io/dagger";

@object()
export class Website {
	/**
	 * Build the website and get the output directory.
	 */
	@func()
	async build(
		@argument({ defaultPath: ".", ignore: ["node_modules"] }) source: Directory,
	): Promise<Directory> {
		return dag
			.bun()
			.install(source)
			.withMountedFile(
				"/usr/local/bin/d2",
				dag.container().from("terrastruct/d2").file("/usr/local/bin/d2"),
			)
			.withExec(["bun", "run", "build"])
			.directory("dist");
	}

	/**
	 * Build Storybook and get the output directory.
	 */
	@func()
	async buildStorybook(
		@argument({ defaultPath: ".", ignore: ["node_modules"] }) source: Directory,
	): Promise<Directory> {
		return dag
			.bun()
			.withCache()
			.install(source)
			.withExec(["bun", "run", "build-storybook"])
			.directory("storybook-static");
	}
}
