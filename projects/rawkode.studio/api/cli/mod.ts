import { default as inquirer } from "inquirer";
import * as technologies from "./technologies/mod.js";
import * as dataMigrations from "./data-migrations/mod.js";
import pkg from "knex";

export const main = async (db: pkg.Knex<any, unknown[]>) => {
	const answers = await inquirer.prompt([
		{
			type: "list",
			name: "command",
			message: "What do you want to do?",
			choices: [
				"Create a Technology",
				"Episodes: YAML -> HCL",
				"Episodes: HCL -> SQL",
			],
		},
	]);

	switch (answers.command) {
		case "Create a Technology":
			await technologies.create(db);
			break;

		case "Episodes: YAML -> HCL":
			await dataMigrations.migrateYamlToHcl();
			break;

		case "Episodes: HCL -> SQL":
			await dataMigrations.migrateHclToSql();
			break;

		default:
			console.log("Unknown command");
	}
};
