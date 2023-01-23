import Client from "@dagger.io/dagger";
import { DaggerCommand } from "@rawkode.academy/dagger/index.mjs";
import { resolveSecret } from "@rawkode.academy/dagger/secrets/index.mjs";
import { getSourceDir } from "@rawkode.academy/dagger/utils/index.mjs";
import { PullRequest } from "@rawkode.academy/dagger/github/index.js";
import { Octokit } from "@octokit/rest";
import { createActionAuth } from "@octokit/auth-action";
import { Container } from "@dagger.io/dagger/dist/api/client.gen.js";

export const execute = async (client: Client): Promise<void> => {
	const pullRequestRef = process.env["GITHUB_HEAD_REF"] || "";

	const pullRequest: PullRequest = {
		isIt: pullRequestRef !== "",
		headRef: pullRequestRef,
		ref: process.env["GITHUB_REF"] || "",
	};

	const sourcePath = getSourceDir(`${import.meta.url}/..`);

	const cloudflareApiToken = await resolveSecret({
		vault: "sa.rawkode.academy",
		item: "Cloudflare",
		key: "password",
	});

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

	const output = await result.stdout();

	if (pullRequest.isIt) {
		const results = output.match(/(https:\/\/rawkode-academy-.*.web.app)/);

		console.debug(results);
		if (!results || results.length <= 0) {
			return;
		}
		const previewUrl = results[0];

		const octokit = new Octokit({
			authStrategy: createActionAuth,
		});

		const regexResultTwo = pullRequest.ref.match(/refs\/pull\/(\d+)\/merge/);
		console.debug(regexResultTwo);
		if (!regexResultTwo || regexResultTwo.length <= 0) {
			return;
		}

		octokit.issues.createComment({
			repo: "RawkodeAcademy",
			owner: "RawkodeAcademy",
			issue_number: parseInt(regexResultTwo[1]),
			body: `Preview URL: ${previewUrl}`,
		});
	}
};

const command: DaggerCommand = {
	name: "deploy",
	description: "Build & Deploy Rawkode Academy Website",
	execute,
};
export default command;
