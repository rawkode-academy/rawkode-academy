import { Container, dag, func, object, Secret } from "@dagger.io/dagger";

@object()
export class Github {
	/**
	 * Creates a container with GitHub CLI installed
	 */
	private githubCliContainer(): Container {
		return dag
			.container()
			.from("alpine:3.19")
			.withExec(["apk", "add", "--no-cache", "curl", "tar", "ca-certificates"])
			.withExec([
				"sh",
				"-c",
				"curl -fsSL https://github.com/cli/cli/releases/download/v2.63.2/gh_2.63.2_linux_amd64.tar.gz | tar -xz -C /tmp",
			])
			.withExec([
				"sh",
				"-c",
				"mv /tmp/gh_2.63.2_linux_amd64/bin/gh /usr/local/bin/gh && chmod +x /usr/local/bin/gh",
			])
			.withExec(["sh", "-c", "rm -rf /tmp/gh_2.63.2_linux_amd64"]);
	}

	/**
	 * Posts a comment to a GitHub Pull Request.
	 *
	 * @param apiToken Secret containing the GitHub token for posting comments.
	 * @param repository The GitHub repository in the format "owner/repository".
	 * @param pullRequestNumber The number of the Pull Request.
	 * @param comment The content of the comment to post.
	 */
	@func()
	async postPullRequestComment(
		apiToken: Secret,
		repository: string,
		pullRequestNumber: string,
		comment: string,
	): Promise<Container> {
		return this.githubCliContainer()
			.withSecretVariable("GH_TOKEN", apiToken)
			.withExec([
				"gh",
				"pr",
				"comment",
				pullRequestNumber,
				"--repo",
				repository,
				"--body",
				comment,
			]);
	}
}
