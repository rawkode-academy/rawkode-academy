import Client from "@dagger.io/dagger";
import { getSourceDir } from "../utils/index.js";
import { Directory } from "@dagger.io/dagger/dist/api/client.gen";

interface Config {
  version: string;
  runtime: "nodejs" | "go";
  stack: string;
  programDirectory: Directory;

  stackCreate?: boolean;
  accessToken?: string;
  passphrase?: string;
  environmentVariables?: Record<string, string>;
  googleCloudGkeCluster?: boolean;
}

export const up = async (client: Client, config: Config): Promise<Object> => {
  const entrypointDir = client
    .host()
    .directory(`${getSourceDir(import.meta.url)}/scripts`);

  let pulumi = client
    .container()
    .from(`pulumi/pulumi-${config.runtime}:${config.version}`)
    .withMountedDirectory("/entrypoint", entrypointDir)
    .withMountedDirectory("/work", config.programDirectory)
    .withWorkdir("/work")
    .withEnvVariable("PULUMI_RUNTIME", config.runtime)
    .withEnvVariable("PULUMI_STACK", config.stack)
    .withEnvVariable(
      "PULUMI_STACK_CREATE",
      config.stackCreate ? "true" : "false"
    );

  for (const key in config.environmentVariables) {
    pulumi = pulumi.withEnvVariable(key, config.environmentVariables[key]);
  }

  if (config.googleCloudGkeCluster) {
    pulumi = pulumi.withEnvVariable("GCLOUD_GKE", "YES");
  }

  const result = await pulumi.withExec(["/entrypoint/up.sh"]);

  if ((await result.exitCode()) !== 0) {
    const stderr = await result.stderr();
    throw new Error(`Pulumi up failed: ${stderr}`);
  }

  const getOutputJson = await result.file("/output/json").contents();
  return JSON.parse(getOutputJson);
};

export const preview = async (
  client: Client,
  config: Config
): Promise<string> => {
  const entrypointDir = client
    .host()
    .directory(`${getSourceDir(import.meta.url)}/scripts`);

  let pulumi = client
    .container()
    .from(`pulumi/pulumi-${config.runtime}:${config.version}`)
    .withMountedDirectory("/entrypoint", entrypointDir)
    .withMountedDirectory("/work", config.programDirectory)
    .withWorkdir("/work")
    .withEnvVariable("PULUMI_RUNTIME", config.runtime)
    .withEnvVariable("PULUMI_STACK", config.stack)
    .withEnvVariable(
      "PULUMI_STACK_CREATE",
      config.stackCreate ? "true" : "false"
    );

  for (const key in config.environmentVariables) {
    pulumi = pulumi.withEnvVariable(key, config.environmentVariables[key]);
  }

  if (config.googleCloudGkeCluster) {
    pulumi = pulumi.withEnvVariable("GCLOUD_GKE", "YES");
  }

  const result = await pulumi.withExec(["/entrypoint/preview.sh"]);

  if ((await result.exitCode()) !== 0) {
    const stderr = await result.stderr();
    throw new Error(`Pulumi up failed: ${stderr}`);
  }

  return await result.stdout();
};
