// @deno-types="npm:@types/inquirer"
import { default as inquirer } from "inquirer";
// @deno-types="npm:@types/inquirer-autocomplete-prompt"
import { default as inquirerPrompt } from "inquirer-autocomplete-prompt";
import { Knex } from "knex";
import { Technologies } from "../../types.js";

inquirer.registerPrompt("autocomplete", inquirerPrompt);

export const create = async (db: Knex<any, unknown[]>) => {
	const technology = await inquirer.prompt([
		{
			type: "autocomplete",
			name: "name",
			suggestOnly: true,
			message: "What is this technology called?",
			searchText: "Search for existing technologies...",
			emptyText: "No Results. Safe to create.",
			source: async (_answers: string[], input: string) => {
				return Array.from(
					await db<Technologies>("technologies")
						.whereLike("name", `%${input}%`)
						.select("name"),
				);
			},
			// validate: async (input: string) => {
			//     const technology = await e
			//         .select(Technology, () => ({
			//             name: true,
			//             filter_single: {
			//                 name: input,
			//             },
			//         }))
			//         .run(client);

			//     return technology === null
			//         ? true
			//         : `${input} already exists in the database`;
			// },
		},
		// {
		//     type: "confirm",
		//     name: "openSource",
		//     message: "Is this technology open source?",
		// },
		{
			type: "input",
			name: "description",
			message: "Describe this technology",
			// when: (answers) => answers.openSource,
		},
		{
			type: "input",
			name: "repository",
			message: "URL for this technologies repository?",
			// when: (answers) => answers.openSource,
		},
		{
			type: "input",
			name: "website",
			message: "URL for this technologies website?",
		},
		{
			type: "input",
			name: "documentation",
			message: "URL for this technologies documentation?",
		},
	]);

	await db.insert(technology).into("technologies");

	return db.destroy();
};
