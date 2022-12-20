import Client from "@dagger.io/dagger";
import {
  getSecrets,
  toSimpleMap,
} from "@RawkodeAcademy/dagger/doppler/index.js";
import { getSourceDir } from "@RawkodeAcademy/dagger/utils/index.js";
import { up } from "@RawkodeAcademy/dagger/pulumi/dagger.js";
import { DaggerCommand } from "@RawkodeAcademy/dagger/index.js";

const deploy = async (client: Client): Promise<Object> => {
  const sourcePath = getSourceDir(`${import.meta.url}/..`);

  const secrets = await getSecrets(client, {
    project: "cloud",
    config: "production",
    seed: "seed",
  });

  const sourceDirectory = await client.host().directory(sourcePath, {
    exclude: [".git", ".pnpm-store", "dagger", "dagger.ts", "node_modules"],
  });

  const returnedJson = await up(client, {
    version: "3.49.0",
    runtime: "nodejs",
    stackCreate: false,
    stack: "production",
    programDirectory: sourceDirectory,
    environmentVariables: toSimpleMap(secrets),
  });

  return returnedJson;
};

const command: DaggerCommand = {
  name: "deploy",
  description: "Deploy Rawkode Cloud infrastructure",
  execute: deploy,
};
export default command;
