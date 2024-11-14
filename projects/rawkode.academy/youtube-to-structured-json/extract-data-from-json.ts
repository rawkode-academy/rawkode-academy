import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { existsSync } from "@std/fs";

const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

if (!geminiApiKey) {
	throw new Error("GEMINI_API_KEY is required");
}

const episode = {
	description: "an Episode",
	type: SchemaType.OBJECT,
	properties: {
		id: {
			type: SchemaType.STRING,
			description: "ID of the episode",
			nullable: false,
		},
		show: {
			type: SchemaType.STRING,
			description: "Show of the episode",
			nullable: false,
		},
		title: {
			type: SchemaType.STRING,
			description: "Title of the episode",
			nullable: false,
		},
		description: {
			type: SchemaType.STRING,
			description: "Description of the episode",
			nullable: false,
		},
		duration: {
			type: SchemaType.STRING,
			description: "Duration of the episode",
			nullable: false,
		},
		chapters: {
			type: SchemaType.ARRAY,
			description: "Chapters of the episode",
			items: {
				type: SchemaType.OBJECT,
				properties: {
					title: {
						type: SchemaType.STRING,
						description: "Title of the chapter",
						nullable: false,
					},
					start: {
						type: SchemaType.STRING,
						description: "Start time of the chapter",
						nullable: false,
					},
				},
			},
		},
		guests: {
			type: SchemaType.ARRAY,
			description: "Guests of the episode",
			items: {
				type: SchemaType.OBJECT,
				properties: {
					name: {
						type: SchemaType.STRING,
						description: "Name of the guest",
						nullable: false,
					},
					biography: {
						type: SchemaType.STRING,
						description: "Biography of the guest",
						nullable: true,
					},
					github: {
						type: SchemaType.STRING,
						description: "GitHub of the guest",
						nullable: true,
					},
					website: {
						type: SchemaType.STRING,
						description: "Website of the guest",
						nullable: true,
					},
					twitter: {
						type: SchemaType.STRING,
						description: "Twitter of the guest",
						nullable: true,
					},
				},
			},
		},
		technologies: {
			type: SchemaType.ARRAY,
			description: "Technologies of the episode",
			items: {
				type: SchemaType.OBJECT,
				properties: {
					name: {
						type: SchemaType.STRING,
						description: "Name of the technology",
						nullable: false,
					},
					website: {
						type: SchemaType.STRING,
						description: "Website of the technology",
						nullable: true,
					},
					github: {
						type: SchemaType.STRING,
						description: "Repository of the technology",
						nullable: true,
					},
					twitter: {
						type: SchemaType.STRING,
						description: "Twitter of the technology",
						nullable: true,
					},
					documentation: {
						type: SchemaType.STRING,
						description: "Documentation of the technology",
						nullable: true,
					},
				},
			},
		},
		links: {
			type: SchemaType.ARRAY,
			description: "Links of the episode",
			items: {
				type: SchemaType.OBJECT,
				properties: {
					url: {
						type: SchemaType.STRING,
						description: "URL of the link",
						nullable: false,
					},
				},
			},
		},
	},
};

const genAI = new GoogleGenerativeAI(geminiApiKey);

const model = genAI.getGenerativeModel({
	model: "gemini-1.5-pro-latest",
	generationConfig: {
		responseMimeType: "application/json",
		responseSchema: episode,
	},
});

for (const file of Deno.readDirSync("./data-from-csv")) {
	const json = JSON.parse(await Deno.readTextFile(`./data-from-csv/${file.name}`));

	if (existsSync(`./data-from-gemini/${json['Video ID']}.json`)) {
		console.log(`Skipping ${json['Video ID']} as it already exists...`);
		continue;
	}


	console.log(`Generating content for ${json['Video ID']}...`);
	const result = await model.generateContent(
		[
			Deno.readTextFileSync("./extract-data-from-json.prompt"),
			Deno.readTextFileSync(`./data-from-csv/${file.name}`),
		],
	);


	Deno.writeTextFileSync(
		`./data-from-gemini/${json['Video ID']}.json`,
		result.response.text(),
	);

	console.log(`Generated content for ${json['Video ID']}`);
}
