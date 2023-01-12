#!/usr/bin/env pnpm exec ts-node --esm
import Client, { connect } from "@dagger.io/dagger";
import { Command } from "commander";
import * as fs from "fs";
import { default as inquirer } from "inquirer";
import { oraPromise } from "ora";

export interface DaggerCommand {
	name: string;
	description: string;
	execute: (client: Client) => any;
}

const dagger = new Command();
dagger
	.name("dagger")
	.description("Dagger CLI")
	.version("0.0.1")
	.option("-L, --log-all", "Log All Output", false);

const globalOptions = dagger.parse(process.argv).optsWithGlobals();

const isDaggerCommand = (arg: any): arg is DaggerCommand => arg;

connect(
	async (client: Client) => {
		const commands = findLoadCommands();
		const localCommands: DaggerCommand[] = [];

		for (const command of commands) {
			const { default: localCommand } = await import(command);
			if (!isDaggerCommand(localCommand)) {
				continue;
			}

			localCommands.push(localCommand);

			dagger
				.command(localCommand.name)
				.description(localCommand.description)
				.action(async () => {
					await oraPromise(async () => await localCommand.execute(client), {
						text: `Executing ${localCommand.name}`,
						failText: `Failed to execute ${localCommand.name}`,
						successText: `Executed ${localCommand.name}`,
					});
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
							return command.description;
						}),
					},
				]);

				const c = localCommands.find(
					(localCommand) => localCommand.description === answers.command,
				);

				if (c === undefined) {
					throw new Error("Couldn't find command");
				}

				await c.execute(client);
			});

		await dagger.parseAsync();
	},
	{
		LogOutput: globalOptions.logAll ? process.stdout : undefined,
	},
);

const findLoadCommands = (): string[] => {
	const localPath = process.cwd();

	return fs
		.readdirSync("./dagger")
		.filter((task) => task.endsWith(".ts") || task.endsWith(".mts"))
		.map((task) => `${localPath}/dagger/${task}`);
};
