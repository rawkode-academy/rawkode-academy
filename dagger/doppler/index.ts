import Client from "@dagger.io/dagger";

interface Config {
  project: string;
  config: string;
  seed: string;
}

interface Secret {
  computed: string;
}

interface Secrets {
  [key: string]: Secret;
}

export const getSecrets = async (client: Client, config: Config) => {
  const dopplerToken = await client
    .host()
    .envVariable("DOPPLER_TOKEN")
    .secret()
    .id();

  const container = client
    .container()
    .from("dopplerhq/cli:3")
    .withEntrypoint(["ash"])
    .withEnvVariable("SEED", config.seed)
    .withEnvVariable("DOPPLER_PROJECT", config.project)
    .withEnvVariable("DOPPLER_CONFIG", config.config)
    .withSecretVariable("DOPPLER_TOKEN", dopplerToken);

  const result = await container.withExec([
    "-c",
    "doppler setup --no-save-token --no-interactive >/dev/null && doppler secrets --json",
  ]);

  if ((await result.exitCode()) !== 0) {
    throw new Error(await result.stderr());
  }

  const stdout = await result.stdout();
  return JSON.parse(stdout) as Secrets;
};
