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
	private _container: Container;

	constructor(version: string = "1-debian") {
		this._container = dag
			.container()
			.from(`oven/bun:${version}`)
			.withWorkdir("/code");
		return;
	}

	@func()
	async withCache(): Promise<Bun> {
		this._container = this._container.withMountedCache(
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
	container(): Container {
		return this._container;
	}

	@func()
	async install(
		@argument({ ignore: [".git", "node_modules"] }) directory: Directory,
		devDependencies = false,
	): Promise<Container> {
		const nodeModules = dag.cacheVolume("node-modules");

		return this
			._container
			.withMountedFile("/code/bun.lock", directory.file("bun.lock"))
			.withMountedFile("/code/package.json", directory.file("package.json"))
			.withExec(["bun", "install", "--frozen-lockfile", devDependencies ? "--dev" : ""])
			.withMountedDirectory("/code", directory).withMountedCache(
				"/code/node_modules",
				nodeModules,
				{
					sharing: CacheSharingMode.Private,
					owner: "bun",
				},
			);
	}

	/**
	 * This is a temporary workaround.
	 * The problem is that the mountedCache above  means when we call
	 * install | directory /code
	 * we only get our code and node_modules doesn't travel with it.
	 * Our existing functions aren't setup to work around this yet.
	 * So here we are.
	 *
	 * @param directory
	 * @returns
	 */
	@func()
	async installNoCache(
		@argument({ ignore: [".git", "node_modules"] }) directory: Directory,
	): Promise<Container> {
		const nodeModules = dag.cacheVolume("node-modules");

		return this
			._container
			.withMountedDirectory("/code", directory)
			.withExec(["bun", "install", "--frozen-lockfile"]);
	}
}
