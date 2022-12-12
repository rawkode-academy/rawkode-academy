#!/usr/bin/env zx
import Client, { connect } from "@dagger.io/dagger";
import * as website from "./projects/website/dagger.js";
import { PullRequest } from "./dagger/github/index.js";

connect(
  async (client: Client) => {
    const pullRequestRef = await client
      .host()
      .envVariable("GITHUB_HEAD_REF")
      .value();

    const pullRequest: PullRequest = {
      isIt: pullRequestRef !== undefined,
      headRef: pullRequestRef,
      ref: await client.host().envVariable("GITHUB_REF").value(),
    };

    await website.deploy(client, pullRequest);
  }
  // Until there's a programmatic secret API, do not merge a commit
  // with this enabled. It prints all secrets to the web viewer.
  // {
  //   LogOutput: process.stdout,
  // }
);
