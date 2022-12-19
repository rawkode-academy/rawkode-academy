import Client, { connect } from "@dagger.io/dagger";
import { deploy } from "./dagger/deploy.js";

connect(
  async (client: Client) => {
    deploy(client);
  },
  {
    LogOutput: process.stdout,
  }
);
