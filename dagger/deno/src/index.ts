import { dag, Container, Directory, object, func, CacheSharingMode } from "@dagger.io/dagger"

@object()
class Deno {
	@func()
	async withCache(
		directory: Directory,
		version: string = "1.46.3",
	): Promise<Container> {
		return dag
			.container()
			.from(`denoland/deno:${version}`)
			.withWorkdir("/code")
			.withMountedFile("/code/deno.jsonc", directory.file("deno.jsonc"))
			.withEnvVariable("DENO_FUTURE", "1")
			.withExec(["deno", "install"])
			.withMountedDirectory("/code", directory)
			.withMountedCache(
				"/deno-dir",
				dag.cacheVolume("deno-cache"),
				{
					sharing: CacheSharingMode.Shared,
					owner: "deno",
				}
			).withExec(["deno", "install", "-Arf", "jsr:@deno/deployctl"])
	}
}
