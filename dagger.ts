#!/usr/bin/env zx
import Client, { connect } from "@dagger.io/dagger";
import * as website from "./projects/website/dagger.js";

connect(
  async (client: Client) => {
    await website.deploy(client);
  },
  {
    LogOutput: process.stdout,
  }
);
