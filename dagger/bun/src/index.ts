import {
	argument,
	CacheSharingMode,
	Container,
	dag,
	Directory,
	func,
	object,
} from "@dagger.io/dagger";

@object()
export class Bun {
	private container: Container;

	constructor(version: string = "1-debian") {
		this.container = dag
			.container()
			.from(`oven/bun:${version}`)
			.withWorkdir("/code");
		return;
	}

	@func()
	async withCache(): Promise<Bun> {
		this.container = this.container.withMountedCache(
			"/home/bun/.bun",
			dag.cacheVolume("bun-cache"),
			{
				sharing: CacheSharingMode.Shared,
				owner: "bun",
			},
		);
		return this;
	}

	@func()
	async install(
		@argument({ ignore: [".git", "node_modules"] }) directory: Directory,
	): Promise<Container> {
		const nodeModules = dag.cacheVolume("node-modules");

		return this
			.container
			.withMountedFile("/code/bun.lock", directory.file("bun.lock"))
			.withMountedFile("/code/package.json", directory.file("package.json"))
			.withMountedCache(
				"/code/node_modules",
				nodeModules,
				{
					sharing: CacheSharingMode.Private,
					owner: "bun",
				},
			)
			.withExec(["bun", "install", "--frozen-lockfile"])
			.withMountedDirectory("/code", directory).withMountedCache(
				"/code/node_modules",
				nodeModules,
				{
					sharing: CacheSharingMode.Private,
					owner: "bun",
				},
			);
	}
}
