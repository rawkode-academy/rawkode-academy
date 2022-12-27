import Client from "@dagger.io/dagger";
import { oraPromise } from "ora";
import { getSourceDir } from "@rawkode.academy/dagger/utils/index.js";
import { up } from "@rawkode.academy/dagger/pulumi/dagger.js";
import { DaggerCommand, SecretApi } from "@rawkode.academy/dagger/index.js";
import { deploy as deployDns } from "@rawkode.academy/dns/dagger/deploy.js";

const deploy = async (client: Client, getSecrets: SecretApi): Promise<void> => {
  const domain = "rawkode.cloud";

  const dnsOutput = await deployDns(client, getSecrets);
  const dnsZoneName = dnsOutput.zoneNameMap[domain];

  const sourcePath = getSourceDir(`${import.meta.url}/..`);

  const secrets = await oraPromise(
    async () => await getSecrets("cloud", "production", ["GOOGLE_CREDENTIALS"]),
    {
      text: "Fetching Secrets ...",
    }
  );
  const sourceDirectory = await client.host().directory(sourcePath, {
    exclude: [".git", ".pnpm-store", "dagger", "dagger.ts", "node_modules"],
  });

  const returnedJson = await up(client, {
    version: "3.49.0",
    runtime: "nodejs",
    stackCreate: false,
    stack: "production",
    programDirectory: sourceDirectory,
    environmentVariables: {
      DNS_ZONE_NAME: dnsZoneName,
      ...secrets,
    },
  });

  return;
};

const command: DaggerCommand = {
  name: "deploy",
  description: "Deploy Rawkode Cloud infrastructure",
  execute: deploy,
};
export default command;
