import Client from "@dagger.io/dagger";
import {
  getSecrets,
  toSimpleMap,
} from "@RawkodeAcademy/dagger/doppler/index.js";
import { getSourceDir } from "@RawkodeAcademy/dagger/utils/index.js";
import { up } from "@RawkodeAcademy/dagger/pulumi/dagger.js";
import { deploy as DnsDeploy } from "@RawkodeAcademy/dns/dagger/deploy.js";

const deploy = async (client: Client): Promise<void> => {
  const dnsOutput = await DnsDeploy(client);
  const rawkodeCloudZoneName = dnsOutput.zoneNameMap["rawkode.cloud"];

  const sourcePath = getSourceDir(`${import.meta.url}/..`);

  const secrets = await getSecrets(client, {
    project: "cloud",
    config: "production",
    seed: "seed",
  });

  const sourceDirectory = await client.host().directory(sourcePath, {
    exclude: [".git", ".pnpm-store", "dagger", "dagger.ts", "node_modules"],
  });

  await up(client, {
    version: "3.49.0",
    runtime: "nodejs",
    stackCreate: false,
    stack: "production",
    programDirectory: sourceDirectory,
    environmentVariables: {
      ...toSimpleMap(secrets),
      DNS_ZONE_NAME: rawkodeCloudZoneName,
    },
  });

  return;
};

export default deploy;
