#!/usr/bin/env pnpm exec ts-node --esm
import Client, { connect } from "@dagger.io/dagger";
import * as axios from "axios";
import { Command } from "commander";
import * as fs from "fs";
import { default as inquirer } from "inquirer";
import { oraPromise } from "ora";
import * as qs from "qs";

export interface DaggerCommand {
  name: string;
  description: string;
  execute: (
    client: Client,
    getSecrets: (
      project: string,
      config: string,
      secrets: string[]
    ) => Promise<Record<string, string>>
  ) => any;
}

interface SecretsResponse {
  secrets: {
    [key: string]: {
      raw: string;
      computed: string;
    };
  };
}

export type SecretApi = (
  project: string,
  config: string,
  secrets: string[]
) => Promise<Record<string, string>>;

const dagger = new Command();
dagger
  .name("dagger")
  .description("Dagger CLI")
  .version("0.0.1")
  .option("-L, --log-all", "Log All Output", false);

const globalOptions = dagger.optsWithGlobals();

console.log(globalOptions);

connect(
  async (client: Client) => {
    const commands = findLoadCommands();
    const localCommands: DaggerCommand[] = [];

    const getSecrets = async (
      project: string,
      config: string,
      secrets: string[]
    ): Promise<Record<string, string>> => {
      const queryString = qs.stringify({
        project,
        config,
        include_dynamic_secrets: false,
        secrets: secrets.join(","),
      });

      const dopplerToken = await client
        .host()
        .envVariable("DOPPLER_TOKEN")
        .secret()
        .plaintext();

      const response = await axios.default.get(
        `https://api.doppler.com/v3/configs/config/secrets?${queryString}`,
        {
          headers: {
            "Content-Type": "application/json",
            Accepts: "application/json",
            authorization: `Bearer ${dopplerToken}`,
          },
        }
      );

      const fetchedSecrets = response.data as SecretsResponse;
      const records: Record<string, string> = {};

      const secretKeys = Object.keys(fetchedSecrets.secrets);
      secretKeys.forEach((secretKey) => {
        records[secretKey] = fetchedSecrets.secrets[secretKey].computed;
      });

      return records;
    };

    for (const command of commands) {
      const { default: localCommand }: { default: DaggerCommand } =
        await import(command);

      localCommands.push(localCommand);

      dagger
        .command(localCommand.name)
        .description(localCommand.description)
        .action(async () => {
          await oraPromise(
            async () => await localCommand.execute(client, getSecrets),
            {
              text: `Executing ${localCommand.name}`,
              failText: `Failed to execute ${localCommand.name}`,
              successText: `Executed ${localCommand.name}`,
            }
          );
        });
    }

    const defaultCommand = dagger
      .command("interactive", {
        isDefault: true,
      })
      .action(async () => {
        const answers = await inquirer.prompt([
          {
            type: "list",
            name: "command",
            message: "What would you like to do?",
            choices: localCommands.map((command) => {
              return command.name;
            }),
          },
        ]);

        const c = localCommands.find(
          (localCommand) => localCommand.name === answers.command
        );

        if (c === undefined) {
          throw new Error("Couldn't find command");
        }

        await c.execute(client, getSecrets);
      });

    await dagger.parseAsync();
  },
  {
    LogOutput: globalOptions.logAll ? process.stdout : process.stdout,
  }
);

const findLoadCommands = (): string[] => {
  const localPath = process.cwd();

  return fs
    .readdirSync("./dagger")
    .filter((task) => task.endsWith(".ts"))
    .map((task) => `${localPath}/dagger/${task}`);
};
