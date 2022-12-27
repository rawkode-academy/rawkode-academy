import Client from "@dagger.io/dagger";
import { Directory } from "@dagger.io/dagger/dist/api/client.gen";
import "zx/globals";

const VERSION = "v0.38.2";

interface Config {
  githubToken: string;
  artifactName: string;
  path: Directory;
}

export const pushArtifact = async (client: Client, config: Config) => {
  const source = await (await $`git remote get-url origin`).toString().trim();
  const branch = await (await $`git branch --show-current`).toString().trim();
  const revision = await (await $`git rev-parse HEAD`).toString().trim();

  const fluxCli = client
    .container()
    .from(`ghcr.io/fluxcd/flux-cli:${VERSION}`)
    .withUser("root")
    .withMountedDirectory("/app", config.path)
    .withEntrypoint(["flux"]);

  const result = await fluxCli.withExec([
    "push",
    "artifact",
    `--creds=rawkode:${config.githubToken}`,
    `oci://ghcr.io/rawkodeacademy/${config.artifactName}:latest`,
    `--path=/app`,
    `--source=${source}`,
    `--revision=${branch}/${revision}`,
  ]);

  if ((await result.exitCode()) !== 0) {
    throw new Error(await result.stderr());
  }
};
