import Client from "@dagger.io/dagger";
import { DaggerCommand } from "@rawkode.academy/dagger/index.js";
import { resolveSecrets } from "@rawkode.academy/dagger/secrets/index.mjs";
import { getSourceDir } from "@rawkode.academy/dagger/utils/index.js";
import { PullRequest } from "@rawkode.academy/dagger/github/index.js";
import { Container } from "@dagger.io/dagger/dist/api/client.gen.js";
import { Octokit } from "@octokit/rest";
import { createActionAuth } from "@octokit/auth-action";

export const deploy = async (client: Client) => {
	const pullRequestRef = await client
		.host()
		.envVariable("GITHUB_HEAD_REF")
		.value();

	const pullRequest: PullRequest = {
		isIt: pullRequestRef !== "",
		headRef: pullRequestRef,
		ref: await client.host().envVariable("GITHUB_REF").value(),
	};

	const sourcePath = getSourceDir(`${import.meta.url}/..`);

	const secrets = await resolveSecrets([
		{
			vault: "sa.rawkode.academy",
			item: "website",
			key: "firebase-token",
			as: "FIREBASE_TOKEN",
		},
	]);

	const npmInstallFiles = await client
		.host()
		.directory(sourcePath, {
			include: ["package.json", "package-lock.json"],
		})
		.id();

	// const npmInstallCache = await client.cacheVolume("npm-install-cache").id();

	const npmInstall = await client
		.container()
		.from("node:lts-slim")
		.withMountedDirectory("/app", npmInstallFiles)
		// .withMountedCache("/app/node_modules", npmInstallCache)
		.withWorkdir("/app")
		.withExec(["corepack", "enable"])
		.withExec(["corepack", "prepare", "pnpm@latest", "--activate"])
		.withExec(["pnpm", "install"]);

	const sourceDirectory = await client
		.host()
		.directory(sourcePath, {
			exclude: [".git", "node_modules"],
		})
		.id();

	const build = await client
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

	if (pullRequest.isIt === true) {
		result = await build
			.withNewFile("/gcloud.json", {
				contents: secrets["FIREBASE_TOKEN"],
			})
			.withEnvVariable("GOOGLE_APPLICATION_CREDENTIALS", "/gcloud.json")
			.withExec([
				"./node_modules/.bin/firebase",
				"hosting:channel:deploy",
				pullRequest.headRef,
			]);
	} else {
		result = await build
			.withNewFile("/gcloud.json", {
				contents: secrets["FIREBASE_TOKEN"],
			})
			.withEnvVariable("GOOGLE_APPLICATION_CREDENTIALS", "/gcloud.json")
			.withExec(["./node_modules/.bin/firebase", "deploy", "--only=hosting"]);
	}

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
	execute: deploy,
};
export default command;
