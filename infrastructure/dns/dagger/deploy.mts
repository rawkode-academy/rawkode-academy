import Client from "@dagger.io/dagger";
import { DaggerCommand } from "@rawkode.academy/dagger/index.mjs";
import { resolveSecret } from "@rawkode.academy/dagger/secrets/index.mjs";
import { getSourceDir } from "@rawkode.academy/dagger/utils/index.mjs";
import { destroy } from "@rawkode.academy/dagger/cdktf/index.mjs";
import { TaskInnerAPI } from "tasuku";

const execute = async (client: Client, tasuku: TaskInnerAPI): Promise<void> => {
	const sourcePath = getSourceDir(`${import.meta.url}/..`);

	const cloudflareApiToken = (
		await tasuku.task(
			"Fetching Secrets from 1Password ...",
			async () =>
				await resolveSecret({
					vault: "sa.core.dns",
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

	await destroy(client, tasuku, {
		programDirectory: sourceDirectory,
	});
};

const command: DaggerCommand = {
	name: "deploy",
	description: "Deploy Latest DNS Configuration",
	execute,
};

export default command;
