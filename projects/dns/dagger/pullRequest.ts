import Client from "@dagger.io/dagger";
import {
  getSecrets,
  toSimpleMap,
} from "@RawkodeAcademy/dagger/doppler/index.js";
import { getSourceDir } from "@RawkodeAcademy/dagger/utils/index.js";
import { preview } from "@RawkodeAcademy/dagger/pulumi/dagger.js";
import { DaggerCommand } from "@RawkodeAcademy/dagger/index.js";

const pullRequest = async (client: Client): Promise<string> => {
  const sourcePath = getSourceDir(`${import.meta.url}/..`);

  const secrets = await getSecrets(client, {
    project: "dns",
    config: "production",
    seed: "seed",
  });

  const sourceDirectory = await client.host().directory(sourcePath, {
    exclude: [".git", ".pnpm-store", "dagger", "dagger.ts", "node_modules"],
  });

  const result = await preview(client, {
    version: "3.49.0",
    runtime: "nodejs",
    stackCreate: false,
    stack: "production",
    programDirectory: sourceDirectory,
    environmentVariables: toSimpleMap(secrets),
  });

  return result;
};

const command: DaggerCommand = {
  name: "pullRequest",
  description: "Preview the Pulumi Diff",
  execute: pullRequest,
};
export default command;
