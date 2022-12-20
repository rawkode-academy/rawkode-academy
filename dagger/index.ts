#!/usr/bin/env pnpm exec ts-node --esm
import Client, { connect } from "@dagger.io/dagger";
import { Command } from "commander";
import { default as inquirer } from "inquirer";
import * as fs from "fs";

export interface DaggerCommand {
  name: string;
  description: string;
  execute: (client: Client) => any;
}

connect(
  async (client: Client) => {
    const dagger = new Command();
    dagger.name("dagger").description("Dagger CLI").version("0.0.1");

    const commands = findLoadCommands();
    const localCommands: DaggerCommand[] = [];

    for (const command of commands) {
      const { default: localCommand }: { default: DaggerCommand } =
        await import(command);

      localCommands.push(localCommand);

      dagger
        .command(localCommand.name)
        .description(localCommand.description)
        .action(() => localCommand.execute(client));
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

        await c.execute(client);
      });

    await dagger.parseAsync();
  },
  {
    LogOutput: process.stdout,
  }
);

const findLoadCommands = (): string[] => {
  const localPath = process.cwd();

  return fs
    .readdirSync("./dagger")
    .filter((task) => task.endsWith(".ts"))
    .map((task) => `${localPath}/dagger/${task}`);
};
