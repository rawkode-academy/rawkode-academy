import Client from "@dagger.io/dagger";
import { DaggerCommand } from "@rawkode.academy/dagger/index.mjs";
import { resolveSecret } from "@rawkode.academy/dagger/secrets/index.mjs";
import { getSourceDir } from "@rawkode.academy/dagger/utils/index.mjs";
import { pushArtifact } from "@rawkode.academy/dagger/fluxcd/index.mjs";

export const execute = async (client: Client): Promise<boolean> => {
	const githubToken = await resolveSecret({
		vault: "sa.rawkode.studio",
		item: "GitHub",
		key: "password",
	});

	const sourcePath = getSourceDir(`${import.meta.url}/..`);
	const sourceDirectory = client.host().directory(`${sourcePath}/deploy`, {
		exclude: [".git", ".pnpm-store", "dagger", "dagger.ts", "node_modules"],
	});

	await pushArtifact(client, {
		artifactName: "studio-deploy",
		githubToken: githubToken,
		path: sourceDirectory,
	});

	return true;
};

const command: DaggerCommand = {
	name: "deploy",
	description: "Push Deployment Manifests to OCI Registry",
	execute,
};
export default command;
