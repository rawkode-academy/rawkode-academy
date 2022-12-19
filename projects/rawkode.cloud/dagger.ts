#!/usr/bin/env pnpm exec ts-node --esm
import Client, { connect } from "@dagger.io/dagger";
import deploy from "./dagger/deploy.js";

connect(
  async (client: Client) => {
    await deploy(client);
  },
  {
    LogOutput: process.stdout,
  }
);
