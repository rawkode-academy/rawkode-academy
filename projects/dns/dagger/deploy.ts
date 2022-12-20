import Client from "@dagger.io/dagger";
import {
  getSecrets,
  toSimpleMap,
} from "@RawkodeAcademy/dagger/doppler/index.js";
import { getSourceDir } from "@RawkodeAcademy/dagger/utils/index.js";
import { up } from "@RawkodeAcademy/dagger/pulumi/dagger.js";
import { z } from "zod";
import { DaggerCommand } from "@RawkodeAcademy/dagger/index.js";
import { oraPromise } from "ora";

const ZoneMap = z.record(z.string());
type ZoneMap = z.infer<typeof ZoneMap>;

const PulumiOutput = z.object({
  zoneNameMap: ZoneMap,
});
type PulumiOutput = z.infer<typeof PulumiOutput>;

const deploy = async (client: Client): Promise<PulumiOutput> => {
  const sourcePath = getSourceDir(`${import.meta.url}/..`);

  const secrets = await oraPromise(
    async () =>
      await getSecrets(client, {
        project: "dns",
        config: "production",
        seed: "seed",
      }),
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
        environmentVariables: toSimpleMap(secrets),
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
