import { dag, Directory, File, object, func } from "@dagger.io/dagger"

@object
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class Cargo {
	/**
	 * example usage: "dagger call build --platform aarch64-apple-darwin --bin foo"
	 */
	@func
	build(platform: string, bin: string, sourceDir: Directory): File {
		return dag
			.container()
			.from("rust")
			.withExec(["rustup", "target", "add", platform])
			.withDirectory("/code", sourceDir)
			.withWorkdir("/code")
			.withExec(["cargo", "build", "--target", platform, "--bin", bin])
			.file(`/code/target/${platform}/debug/${bin}`)
	}
}
