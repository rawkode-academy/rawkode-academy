import Client from "@dagger.io/dagger";
import { getSecrets, toSimpleMap } from "@RawkodeAcademy/dagger/doppler";
import { up } from "@RawkodeAcademy/dagger/pulumi/dagger.js";
import { getSourceDir } from "@RawkodeAcademy/dagger/utils";

export const deploy = async (client: Client) => {
  const sourcePath = getSourceDir(import.meta.url);

  const secrets = await getSecrets(client, {
    project: "dns",
    config: "production",
    seed: "seed",
  });

  const npmInstallFiles = await client.host().directory(sourcePath, {
    include: ["package.json", "package-lock.json"],
  });

  const npmInstallCache = await client.cacheVolume("npm-install-cache");

  const npmInstall = await client
    .container()
    .from("node:lts-slim")
    .withMountedDirectory("/app", npmInstallFiles)
    .withMountedCache("/app/node_modules", npmInstallCache)
    .withWorkdir("/app")
    .withExec(["npm", "install"]);

  const sourceDirectory = await client.host().directory(sourcePath, {
    exclude: [".git", "dagger", "dagger.ts", "node_modules"],
  });

  const pulumiUp = await up(client, {
    version: "3.7.0",
    runtime: "nodejs",
    stackCreate: false,
    stack: "production",
    programDirectory: sourceDirectory,
    environmentVariables: toSimpleMap(secrets),
  });

  console.debug(pulumiUp);
};
