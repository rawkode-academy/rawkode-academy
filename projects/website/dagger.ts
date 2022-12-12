import Client, { connect } from "@dagger.io/dagger";
import { v4 as uuidv4 } from "uuid";
import { getSourceDir } from "../../dagger/utils/index.js";
import { getSecrets } from "../../dagger/doppler/index.js";
import { PullRequest } from "../../dagger/github/index.js";
import { Container } from "@dagger.io/dagger/dist/api/client.gen.js";
import { Octokit } from "@octokit/rest";
import { createActionAuth } from "@octokit/auth-action";

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
      .withExec([
        "./node_modules/.bin/firebase",
        "hosting:channel:deploy",
        pullRequest.headRef,
      ]);
  } else {
    result = await build
      .withNewFile("/gcloud.json", {
        contents: secrets["FIREBASE_TOKEN"].computed,
      })
      .withEnvVariable("GOOGLE_APPLICATION_CREDENTIALS", "/gcloud.json")
      .withExec(["./node_modules/.bin/firebase", "deploy", "--only=hosting"]);
  }

  const output = await result.stdout();

  if (pullRequest.isIt) {
    const previewUrl = output.match(
      /(https:\/\/rawkode-academy-.*.web.app)/
    )[1];

    const octokit = new Octokit({
      authStrategy: createActionAuth,
    });

    octokit.issues.createComment({
      repo: "RawkodeAcademy",
      owner: "RawkodeAcademy",
      issue_number: parseInt(
        pullRequest.ref.match(/refs\/pull\/(\d+)\/merge/)[1]
      ),
      body: `Preview URL: ${previewUrl}`,
    });
  }
};
