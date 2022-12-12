import Client, { connect } from "@dagger.io/dagger";
import { v4 as uuidv4 } from "uuid";
import { getSourceDir } from "../../dagger/utils/index.js";
import { getSecrets } from "../../dagger/doppler/index.js";
import { PullRequest } from "../../dagger/github/index.js";
import { Container } from "@dagger.io/dagger/dist/api/client.gen.js";

export const deploy = async (client: Client, pullRequest: PullRequest) => {
  const uuid = uuidv4();

  const sourcePath = getSourceDir(import.meta.url);

  const secrets = await getSecrets(client, {
    project: "website",
    config: "production",
    seed: uuid,
  });

  const npmInstallFiles = await client
    .host()
    .directory(sourcePath, {
      include: ["package.json", "package-lock.json"],
    })
    .id();

  // const npmInstallCache = await client.cacheVolume("npm-install-cache").id();

  const npmInstall = await client
    .container()
    .from("node:lts-slim")
    .withMountedDirectory("/app", npmInstallFiles)
    // .withMountedCache("/app/node_modules", npmInstallCache)
    .withWorkdir("/app")
    .withExec(["npm", "install"]);

  console.debug(await npmInstall.stdout());

  const sourceDirectory = await client
    .host()
    .directory(sourcePath, {
      exclude: [".git", "node_modules"],
    })
    .id();

  const build = await client
    .container()
    .from("node:lts-slim")
    .withMountedDirectory("/app", sourceDirectory)
    .withMountedDirectory(
      "/app/node_modules",
      npmInstall.directory("/app/node_modules")
    )
    .withWorkdir("/app")
    .withExec(["npm", "run", "build"]);

  let result: Container;

  if (pullRequest.isIt === true) {
    result = await build
      .withNewFile("/gcloud.json", {
        contents: secrets["FIREBASE_TOKEN"].computed,
      })
      .withEnvVariable("GOOGLE_APPLICATION_CREDENTIALS", "/gcloud.json")
      .withExec(["npx", "firebase", "hosting:channel:deploy", pullRequest.ref]);
  } else {
    let result = await build
      .withNewFile("/gcloud.json", {
        contents: secrets["FIREBASE_TOKEN"].computed,
      })
      .withEnvVariable("GOOGLE_APPLICATION_CREDENTIALS", "/gcloud.json")
      .withExec(["npx", "firebase", "deploy", "--only=hosting"]);
  }

  console.log(await result.stdout());
};
