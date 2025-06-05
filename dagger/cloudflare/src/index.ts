import { dag, Directory, File, func, object, Secret } from "@dagger.io/dagger";

@object()
export class Cloudflare {
	/**
	 * Deploy a website to Cloudflare Workers.
	 */
	@func()
	async deploy(
		dist: Directory,
		wranglerConfig: File,
		cloudflareApiToken: Secret,
	): Promise<string> {
		const cloudflareAccountId = await dag.config().cloudflareAccountId();

		const wranglerFilename = await wranglerConfig.name();

		const deploymentResult = await dag
			.container()
			.from("node:22")
			.withWorkdir("/deploy")
			// Only doing this to cache the wrangler installation
			.withExec(["npx", "wrangler", "--version"])
			.withMountedDirectory("/deploy/dist", dist)
			.withMountedFile(`/deploy/${wranglerFilename}`, wranglerConfig)
			.withEnvVariable("CLOUDFLARE_ACCOUNT_ID", cloudflareAccountId)
			.withSecretVariable("CLOUDFLARE_API_TOKEN", cloudflareApiToken)
			.withExec(["npx", "wrangler", "deploy"]);

		if ((await deploymentResult.exitCode()) !== 0) {
			throw new Error(
				"Deployment failed. Error: " +
					(await deploymentResult.stdout()) +
					(await deploymentResult.stderr()),
			);
		}

		return deploymentResult.stdout();
	}

	/**
	 * Deploy a preview website to Cloudflare Workers.
	 */
	@func()
	async preview(
		dist: Directory,
		wranglerConfig: File,
		cloudflareApiToken: Secret,
		githubApiToken: Secret,
		repository: string,
		pullRequestNumber: string,
	): Promise<string> {
		const cloudflareAccountId = await dag.config().cloudflareAccountId();

		const wranglerFilename = await wranglerConfig.name();

		const deploymentResult = await dag
			.container()
			.from("node:22")
			.withWorkdir("/deploy")
			// Only doing this to cache the wrangler installation
			.withExec(["npx", "wrangler", "--version"])
			.withMountedDirectory("/deploy/dist", dist)
			.withMountedFile(`/deploy/${wranglerFilename}`, wranglerConfig)
			.withEnvVariable("CLOUDFLARE_ACCOUNT_ID", cloudflareAccountId)
			.withSecretVariable("CLOUDFLARE_API_TOKEN", cloudflareApiToken)
			.withExec([
				"npx",
				"wrangler",
				"versions",
				"upload",
				"--config",
				wranglerFilename,
				"--assets",
				"./dist",
			]);

		if ((await deploymentResult.exitCode()) !== 0) {
			throw new Error(
				"Deployment failed. Error: " +
					(await deploymentResult.stdout()) +
					(await deploymentResult.stderr()),
			);
		}

		const allOutput = await deploymentResult.stdout();

		// Extract the preview URL from the output
		// wrangler versions upload outputs a preview URL in the format:
		// "Version preview URL: https://version-hash.worker-name.subdomain.workers.dev"
		const urlMatch =
			allOutput.match(/Version preview URL:\s*(https:\/\/[^\s]+)/i) ||
			allOutput.match(/https:\/\/[^\s]+\.workers\.dev/);
		const previewUrl = urlMatch
			? urlMatch[1] || urlMatch[0]
			: "Preview URL not found";

		// Post the comment but don't fail if it doesn't work
		try {
			await dag
				.github()
				.postPullRequestComment(
					githubApiToken,
					repository,
					pullRequestNumber,
					`Deployment Preview: ${previewUrl}`,
				)
				.exitCode();
		} catch (error) {
			console.log("Failed to post PR comment:", error);
		}

		return allOutput;
	}
}
