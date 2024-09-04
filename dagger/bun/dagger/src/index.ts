import {
	dag,
	Container,
	Directory,
	object,
	func,
	CacheSharingMode,
} from "@dagger.io/dagger";

// As we want to use Bun with cdktf, we're having to use node/npm
// temporarily until https://github.com/oven-sh/bun/issues/4290 is resolved.

@object()
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class Bun {
	/**
	 * Install JavaScript/Typescript dependencies using bun.
	 */
	@func()
	async install(directory: Directory): Promise<Container> {
		const packageJson = directory.file("package.json");
		const workingDirectory = "/code";
		const packageName = `${
			JSON.parse(await packageJson.contents()).name as string
		}-node-modules`;

		return dag
			.container()
			.from("node:21")
			.withMountedDirectory(workingDirectory, directory)
			.withWorkdir(workingDirectory)
			.withMountedCache("/node_modules", dag.cacheVolume(packageName), {
				sharing: CacheSharingMode.Shared,
			})
			.withExec(["npm", "install"]);
	}
}
