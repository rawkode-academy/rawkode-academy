import {
	argument,
	Container,
	dag,
	Directory,
	func,
	object,
	Secret,
} from "@dagger.io/dagger";

@object()
export class Website {
	/**
	 * Build the website and get the output directory.
	 */
	@func()
	async build(
		@argument({ defaultPath: ".", ignore: ["node_modules"] }) source: Directory,
	): Promise<Directory> {
		return dag.bun()
			.withCache()
			.install(source)
			.withMountedFile(
				"/usr/local/bin/d2",
				dag.container()
					.from("terrastruct/d2")
					.file("/usr/local/bin/d2"),
			)
			.withExec([
				"bun",
				"run",
				"build",
			]).directory("dist");
	}

	/**
	 * Deploy the website to Cloudflare Pages.
	 */
	@func()
	async deploy(
		@argument({ defaultPath: "." }) source: Directory,
		cloudflareApiToken: Secret,
		gitHead: string,
	): Promise<string> {
		const cloudflareAccountId = await dag.config().cloudflareAccountId();

		return await dag.container()
			.from("node:22")
			.withWorkdir("/deploy")
			.withExec([
				"npx",
				"wrangler",
				"--help",
			])
			.withMountedDirectory("/deploy/dist", await this.build(source))
			.withMountedFile(
				"/deploy/wrangler.toml",
				source.file("wrangler.toml"),
			)
			.withEnvVariable("CLOUDFLARE_ACCOUNT_ID", cloudflareAccountId)
			.withSecretVariable("CLOUDFLARE_API_TOKEN", cloudflareApiToken)
			.withExec(["npx", "wrangler", "pages", "deploy", `--branch=${gitHead}`, "/deploy/dist"])
			.stdout();
	}
}
