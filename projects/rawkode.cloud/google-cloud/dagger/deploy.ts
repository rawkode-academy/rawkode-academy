import Client from "@dagger.io/dagger";
import { getSourceDir } from "@rawkode.academy/dagger/utils/index.js";
import { up } from "@rawkode.academy/dagger/pulumi/dagger.js";
import { DaggerCommand, SecretApi } from "@rawkode.academy/dagger/index.js";
import { oraPromise } from "ora";

export const deploy = async (
	client: Client,
	getSecrets: SecretApi,
): Promise<void> => {
	const sourcePath = getSourceDir(`${import.meta.url}/..`);

	const secrets = await oraPromise(
		async () =>
			await getSecrets("google-cloud", "production", [
				"GOOGLE_CREDENTIALS",
				"DOPPLER_TOKEN",
			]),
		{
			text: "Fetching Secrets ...",
		},
	);

	const sourceDirectory = await client.host().directory(sourcePath, {
		exclude: [".git", ".pnpm-store", "dagger", "dagger.ts", "node_modules"],
	});

	const returnedJson = await oraPromise(
		async () =>
			await up(client, {
				version: "3.49.0",
				runtime: "nodejs",
				stackCreate: false,
				stack: "production",
				programDirectory: sourceDirectory,
				environmentVariables: secrets,
			}),
		{
			text: "Running Pulumi Up",
		},
	);

	return;
};

const command: DaggerCommand = {
	name: "deploy",
	description: "Deploy the DNS infrastructure",
	execute: deploy,
};
export default command;
