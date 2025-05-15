import {
  dag,
	Directory,
	File,
  func,
  object,
  Secret,
} from "@dagger.io/dagger";

@object()
export class Cloudflare {
  /**
   * Deploy a website to Cloudflare Pages.
   */
  @func()
  async deploy(
		dist: Directory,
		wranglerToml: File,
    cloudflareApiToken: Secret,
    gitlabApiToken: Secret,
    mergeRequestId?: string,
  ): Promise<string> {
    const cloudflareAccountId = await dag.config().cloudflareAccountId();

    const deploymentResult = await dag.container()
      .from("node:22")
      .withWorkdir("/deploy")
      // Only doing this to cache the wrangler installation
      .withExec([
        "npx",
        "wrangler",
        "--version",
      ])
      .withMountedDirectory("/deploy/dist", dist)
      .withMountedFile(
        "/deploy/wrangler.toml",
        wranglerToml,
      )
      .withEnvVariable("CLOUDFLARE_ACCOUNT_ID", cloudflareAccountId)
      .withSecretVariable("CLOUDFLARE_API_TOKEN", cloudflareApiToken)
      .withExec([
        "npx",
        "wrangler",
        "pages",
        "deploy",
        `--branch=${mergeRequestId ? `mr${mergeRequestId}` : "main"}`,
        "/deploy/dist",
      ]);

    if (await deploymentResult.exitCode() !== 0) {
      throw new Error(
        "Deployment failed. Error: " + await deploymentResult.stdout() +
          await deploymentResult.stderr(),
      );
		}

		// remove any line that doesn't start with ✨
		const allOutput = await deploymentResult.stdout();
		const goodOutput = allOutput.split("\n").filter((line) => line.startsWith("✨")).join("\n");

    if (mergeRequestId) {
      return dag.gitlab().postMergeRequestComment(
        gitlabApiToken,
        mergeRequestId,
        goodOutput,
      ).stdout();
    }

    return allOutput;
  }
}
