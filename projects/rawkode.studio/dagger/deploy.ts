import Client from "@dagger.io/dagger";
import { DaggerCommand, SecretApi } from "@rawkode.academy/dagger/index.js";
import { getSourceDir } from "@rawkode.academy/dagger/utils/index.js";
import { pushArtifact } from "@rawkode.academy/dagger/fluxcd/index.js";

export const deploy = async (
  client: Client,
  getSecrets: SecretApi
): Promise<boolean> => {
  const secrets = await getSecrets("studio", "production", ["GITHUB_TOKEN"]);

  const sourcePath = getSourceDir(`${import.meta.url}/..`);
  const sourceDirectory = await client
    .host()
    .directory(`${sourcePath}/deploy`, {
      exclude: [".git", ".pnpm-store", "dagger", "dagger.ts", "node_modules"],
    });

  await pushArtifact(client, {
    artifactName: "studio-deploy",
    githubToken: secrets["GITHUB_TOKEN"],
    path: sourceDirectory,
  });

  return true;
};

const command: DaggerCommand = {
  name: "deploy",
  description: "Deploy",
  execute: deploy,
};
export default command;
