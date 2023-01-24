#!/usr/bin/env pnpm exec ts-node --esm
import Client, { connect } from "@dagger.io/dagger";
import { Command } from "commander";
import * as fs from "fs";
import { default as inquirer } from "inquirer";
import { stringify } from "qs";

export interface DaggerCommand {
	name: string;
	description: string;
	execute: (client: Client) => any;
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
			await connect(
				async (client: Client) => {
					await localCommand.execute(client);
				},
				{
					LogOutput: globalOptions.logAll ? process.stdout : undefined,
				},
			);
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

		await connect(
			async (client: Client) => {
				await c.execute(client);
			},
			{
				LogOutput: globalOptions.logAll ? process.stdout : undefined,
			},
		);
	});

await daggerCli.parseAsync();
