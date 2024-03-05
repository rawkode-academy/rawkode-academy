import {
	dag,
	Container,
	Directory,
	object,
	func,
	CacheSharingMode,
} from "@dagger.io/dagger";

@object()
class TerraformCdk {
	async prepare(sourceDir: Directory): Promise<Container> {
		const packageJson = sourceDir.file("package.json");
		const nodeModules = await dag.bun().install(packageJson);

		const tofuBin = await dag
			.container()
			.from("ghcr.io/opentofu/opentofu:latest")
			.file("/usr/local/bin/tofu");

		return dag
			.container()
			.from("node:21")
			.withWorkdir("/code")
			.withMountedDirectory("/code", sourceDir)
			.withMountedDirectory("/code/node_modules", nodeModules)
			.withEnvVariable("TERRAFORM_BINARY_NAME", "tofu")
			.withFile("/usr/local/bin/tofu", tofuBin)
			.withExec(["npx", "cdktf-cli", "get"]);
	}

	/**
	 * Get Terraform providers and generate SDKs.
	 */
	@func()
	async get(sourceDir: Directory): Promise<Directory> {
		return (await this.prepare(sourceDir)).directory("/code/.gen");
	}

	/**
	 * Run a Terraform CDK Diff (Plan).
	 */
	@func()
	async diff(sourceDir: Directory, stackName: string = ""): Promise<Container> {
		return (await this.prepare(sourceDir)).withExec([
			"npx",
			"cdktf-cli",
			"diff",
			stackName,
		]);
	}
}
