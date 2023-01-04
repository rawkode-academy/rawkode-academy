import Client from "@dagger.io/dagger";
import { DaggerCommand, SecretApi } from "@rawkode.academy/dagger/index.js";
import { getSourceDir } from "@rawkode.academy/dagger/utils/index.js";

export const buildAndPush = async (
	client: Client,
	_: SecretApi,
): Promise<void> => {
	const sourcePath = getSourceDir(`${import.meta.url}/..`);
	const sourceDirectory = await client.host().directory(`${sourcePath}`, {
		exclude: [".git", "dagger", "lib", "node_modules"],
	});

	const builder = await client
		.container()
		.from("node:18-bullseye")
		.withMountedDirectory("/src", sourceDirectory)
		.withWorkdir("/src")
		.withExec(["corepack", "enable"])
		.withExec(["corepack", "prepare", "pnpm@latest"])
		.withExec(["pnpm", "install"])
		.withExec(["pnpm", "run", "build"]);

	console.log(await builder.stdout());

	await client
		.container()
		.from("node:18-bullseye")
		.withDirectory("/app", builder.directory("/src/lib"))
		.withDirectory("/app/node_modules", builder.directory("/src/node_modules"))
		.withDefaultArgs({
			args: ["worker.js"],
		})
		.publish("ghcr.io/rawkodeacademy/studio-workflows-youtube:latest");
};

const command: DaggerCommand = {
	name: "build-and-push",
	description: "Build & Push Image to GHCR",
	execute: buildAndPush,
};
export default command;
