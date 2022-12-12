#!/usr/bin/env zx
import Client, { connect } from "@dagger.io/dagger";
import * as website from "./projects/website/dagger.js";

connect(
  async (client: Client) => {
    await website.deploy(client);
  }
  // Until there's a programmatic secret API, do not merge a commit
  // with this enabled. It prints all secrets to the web viewer.
  // {
  //   LogOutput: process.stdout,
  // }
);
