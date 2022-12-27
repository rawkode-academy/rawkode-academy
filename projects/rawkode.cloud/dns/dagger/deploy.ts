import Client from "@dagger.io/dagger";
import { DaggerCommand, SecretApi } from "@rawkode.academy/dagger/index.js";
import { getSourceDir } from "@rawkode.academy/dagger/utils/index.js";
import { up } from "@rawkode.academy/dagger/pulumi/dagger.js";
import { oraPromise } from "ora";
import { z } from "zod";

const ZoneMap = z.record(z.string());
type ZoneMap = z.infer<typeof ZoneMap>;

const PulumiOutput = z.object({
  zoneNameMap: ZoneMap,
});
type PulumiOutput = z.infer<typeof PulumiOutput>;

export const deploy = async (
  client: Client,
  getSecrets: SecretApi
): Promise<PulumiOutput> => {
  const sourcePath = getSourceDir(`${import.meta.url}/..`);

  const secrets = await oraPromise(
    async () =>
      await getSecrets("dns", "production", [
        "GANDI_KEY",
        "GOOGLE_CREDENTIALS",
      ]),
    {
      text: "Fetching Secrets ...",
    }
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
    }
  );

  console.debug(returnedJson);

  const pulumiOutput = PulumiOutput.safeParse(returnedJson);
  if (!pulumiOutput.success) {
    throw new Error("pulumi up for DNS did not return a valid zone map");
  }

  return pulumiOutput.data;
};

const command: DaggerCommand = {
  name: "deploy",
  description: "Deploy the DNS infrastructure",
  execute: deploy,
};
export default command;
