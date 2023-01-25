#!/usr/bin/env pnpm exec ts-node --esm
import Client, { connect } from "@dagger.io/dagger";
import { Command } from "commander";
import * as fs from "fs";
import { default as inquirer } from "inquirer";
import task, { TaskInnerAPI } from "tasuku";

export interface DaggerCommand {
	name: string;
	description: string;
	execute: (client: Client, task: TaskInnerAPI) => any;
}

const daggerCli = new Command();

daggerCli
	.name("dagger")
	.description("Dagger CLI")
	.version("0.0.1")
	.option("-L, --log-all", "Log All Output", false);

const globalOptions = daggerCli.parse(process.argv).optsWithGlobals();

const isDaggerCommand = (arg: any): arg is DaggerCommand => arg;

const findLoadCommands = (): string[] => {
	const localPath = process.cwd();

	return fs
		.readdirSync("./dagger")
		.filter((task) => task.endsWith(".ts") || task.endsWith(".mts"))
		.map((task) => `${localPath}/dagger/${task}`);
};

const commands = findLoadCommands();
const localCommands: DaggerCommand[] = [];

for (const command of commands) {
	const { default: localCommand } = await import(command);

	if (!isDaggerCommand(localCommand)) {
		continue;
	}

	localCommands.push(localCommand);

	daggerCli
		.command(localCommand.name)
		.description(localCommand.description)
		.action(async () => {
			task("Connecting to Dagger", async ({ task }) => {
				await connect(
					async (client: Client) => {
						await task(
							localCommand.description,
							async (taskApi) => await localCommand.execute(client, taskApi),
						);
					},
					{
						LogOutput: globalOptions.logAll ? process.stdout : undefined,
					},
				);
			});
		});
}

const defaultCommand = daggerCli
	.command("interactive", {
		isDefault: true,
	})
	.action(async () => {
		const answers = await inquirer.prompt([
			{
				type: "list",
				name: "command",
				message: "What would you like to do?",
				choices: localCommands.map((command) => command.description),
			},
		]);

		const c = localCommands.find(
			(localCommand) => localCommand.description === answers.command,
		);

		if (c === undefined) {
			throw new Error("Couldn't find command");
		}

		task("Connecting to Dagger", async ({ task }) => {
			await connect(
				async (client: Client) => {
					await task(
						c.description,
						async (taskApi) => await c.execute(client, taskApi),
					);
				},
				{
					LogOutput: globalOptions.logAll ? process.stdout : undefined,
				},
			);
		});
	});

await daggerCli.parseAsync();
