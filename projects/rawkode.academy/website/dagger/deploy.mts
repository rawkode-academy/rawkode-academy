import Client from "@dagger.io/dagger";
import { Container } from "@dagger.io/dagger/dist/api/client.gen.js";
import { createActionAuth } from "@octokit/auth-action";
import { Octokit } from "@octokit/rest";
import { PullRequest } from "@rawkode.academy/dagger/github/index.js";
import { DaggerCommand } from "@rawkode.academy/dagger/index.mjs";
import { resolveSecret } from "@rawkode.academy/dagger/secrets/index.mjs";
import { getSourceDir } from "@rawkode.academy/dagger/utils/index.mjs";
import { TaskInnerAPI } from "tasuku";

const execute = async (client: Client, tasuku: TaskInnerAPI): Promise<void> => {
	const pullRequestRef = process.env["GITHUB_HEAD_REF"] || "";

	const pullRequest: PullRequest = {
		isIt: pullRequestRef !== "",
		headRef: pullRequestRef,
		ref: process.env["GITHUB_REF"] || "",
	};

	switch (pullRequest.isIt) {
		case true:
			tasuku.setStatus("Pull Request / Preview Deploy");
			break;
		case false:
			tasuku.setStatus("Main Branch");
			break;
	}

	const sourcePath = getSourceDir(`${import.meta.url}/..`);

	const cloudflareApiToken = (
		await tasuku.task(
			"Fetching Secrets from 1Password ...",
			async () =>
				await resolveSecret({
					vault: "sa.rawkode.academy",
					item: "Cloudflare",
					key: "password",
				}),
		)
	).result;

	const npmInstallFiles = client.host().directory(sourcePath, {
		include: ["package.json", "package-lock.json"],
	});

	const npmInstall = client
		.container()
		.from("node:lts-slim")
		.withMountedDirectory("/app", npmInstallFiles)
		.withWorkdir("/app")
		.withExec(["corepack", "enable"])
		.withExec(["corepack", "prepare", "pnpm@latest", "--activate"])
		.withExec(["pnpm", "install"]);

	const sourceDirectory = client.host().directory(sourcePath, {
		exclude: [".git", "node_modules"],
	});

	const build = client
		.container()
		.from("node:lts-slim")
		.withMountedDirectory("/app", sourceDirectory)
		.withMountedDirectory(
			"/app/node_modules",
			npmInstall.directory("/app/node_modules"),
		)
		.withWorkdir("/app")
		.withExec(["corepack", "enable"])
		.withExec(["corepack", "prepare", "pnpm@latest", "--activate"])
		.withExec(["pnpm", "run", "build"]);

	let result: Container;

	result = build
		.withEnvVariable("CLOUDFLARE_API_TOKEN", cloudflareApiToken)
		.withEnvVariable(
			"CLOUDFLARE_ACCOUNT_ID",
			"0aeb879de8e3cdde5fb3d413025222ce",
		)
		.withExec([
			"./node_modules/.bin/wrangler",
			"pages",
			"publish",
			"dist",
			"--project-name=rawkode-academy",
			`--branch=${pullRequest.isIt ? pullRequest.headRef : "main"}`,
		]);

	const websiteUrl = (
		await tasuku.task(
			"Publishing to Cloudflare",
			async ({ setStatus, setError }) => {
				const output = await result.stdout();
				const websiteMatcher = output.match(/(https:\/\/.*)/);
				if (!websiteMatcher || websiteMatcher.length < 1) {
					return setError("Failed to find URL from publish output");
				}

				const websiteUrl = websiteMatcher[1];
				setStatus(websiteUrl);
				return websiteUrl;
			},
		)
	).result;

	if (pullRequest.isIt) {
		await tasuku.task(
			"Adding Comment to Pull Request",
			async ({ setError, setOutput, setStatus }) => {
				const octokit = new Octokit({
					authStrategy: createActionAuth,
				});

				const pullRequestNumberMatcher = pullRequest.ref.match(
					/refs\/pull\/(\d+)\/merge/,
				);

				if (!pullRequestNumberMatcher || pullRequestNumberMatcher.length < 2) {
					return setError(
						"Failed to extract pull request number from GITHUB_REF",
					);
				}
				const pullRequestNumber = pullRequestNumberMatcher[1];

				setStatus(`PR #${pullRequestNumber}`);

				const result = await octokit.issues.createComment({
					repo: "RawkodeAcademy",
					owner: "RawkodeAcademy",
					issue_number: parseInt(pullRequestNumber),
					body: `Preview URL: ${websiteUrl}`,
				});

				setOutput(`Status ${result.status}`);

				if (result.status !== 201) {
					setError("Failed to add comment to pull request");
				}
			},
		);
	}
};

const command: DaggerCommand = {
	name: "deploy",
	description: "Build & Deploy Rawkode Academy Website",
	execute,
};

export default command;
