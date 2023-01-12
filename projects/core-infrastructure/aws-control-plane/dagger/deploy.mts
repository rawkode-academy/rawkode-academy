import Client from "@dagger.io/dagger";
import { DaggerCommand } from "@rawkode.academy/dagger/index.mjs";
import { up } from "@rawkode.academy/dagger/pulumi/dagger.mjs";
import { resolveSecret } from "@rawkode.academy/dagger/secrets/index.mjs";
import { getSourceDir } from "@rawkode.academy/dagger/utils/index.mjs";
import { pulumiConfig } from "./config.mjs";

export const execute = async (client: Client): Promise<void> => {
	const sourcePath = getSourceDir(`${import.meta.url}/..`);

	const pulumiAccessToken = await resolveSecret({
		vault: "sa.core.infrastructure",
		item: "Pulumi",
		key: "password",
	});
	const awsAccessID = await resolveSecret({
		vault: "Private",
		item: "aws-root-credentials",
		key: "username",
	});
	const awsAccessKey = await resolveSecret({
		vault: "Private",
		item: "aws-root-credentials",
		key: "password",
	});

	const sourceDirectory = client.host().directory(sourcePath, {
		exclude: [".editorconfig", ".git", "dagger", "node_modules", "rome.json"],
	});

	await up(client, {
		...pulumiConfig,
		stack: "production",
		accessToken: pulumiAccessToken,
		programDirectory: sourceDirectory,
		environmentVariables: {
			AWS_ACCESS_KEY_ID: awsAccessID,
			AWS_SECRET_ACCESS_KEY: awsAccessKey,
		},
	});

	return;
};

const command: DaggerCommand = {
	name: "deploy",
	description: "Deploy the AWS Control Plane",
	execute,
};
export default command;
