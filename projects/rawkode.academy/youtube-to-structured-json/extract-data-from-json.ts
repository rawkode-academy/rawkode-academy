import {
	DynamicRetrievalMode,
	GoogleGenerativeAI,
	SchemaType,
} from "@google/generative-ai";
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
		},
		show: {
			type: SchemaType.STRING,
			description: "Show of the episode",
		},
		title: {
			type: SchemaType.STRING,
			description: "Title of the episode",
		},
		firstWordTimestamp: {
			type: SchemaType.STRING,
			description: "When is the first word said?",
		},
		lastWordTimestamp: {
			type: SchemaType.STRING,
			description: "When is the last word said?",
		},
		practicalityScore: {
			type: SchemaType.STRING,
			description: "How useful / practical was this?",
		},
		enjoymentScore: {
			type: SchemaType.STRING,
			description: "How enjoyable was this?",
		},
		description: {
			type: SchemaType.STRING,
			description: "Description of the episode",
		},
		duration: {
			type: SchemaType.STRING,
			description: "Duration of the episode",
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
					},
					start: {
						type: SchemaType.STRING,
						description: "Start time of the chapter",
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
					},
					biography: {
						type: SchemaType.STRING,
						description: "Biography of the guest",
					},
					github: {
						type: SchemaType.STRING,
						description: "GitHub of the guest",
					},
					website: {
						type: SchemaType.STRING,
						description: "Website of the guest",
					},
					twitter: {
						type: SchemaType.STRING,
						description: "Twitter of the guest",
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
					},
					website: {
						type: SchemaType.STRING,
						description: "Website of the technology",
					},
					github: {
						type: SchemaType.STRING,
						description: "Repository of the technology",
					},
					documentation: {
						type: SchemaType.STRING,
						description: "Documentation of the technology",
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
					},
				},
			},
		},
	},
};

const genAI = new GoogleGenerativeAI(geminiApiKey);

const model = genAI.getGenerativeModel({
	model: "gemini-1.5-flash-latest",
	generationConfig: {
		responseMimeType: "application/json",
		responseSchema: episode,
	},
});

for (const file of Deno.readDirSync("./data-from-csv")) {
	if (!file.name.endsWith(".json")) {
		continue;
	}

	const json = JSON.parse(
		await Deno.readTextFile(`./data-from-csv/${file.name}`),
	);

	if (existsSync(`./data-from-gemini/${json["Video ID"]}.json`)) {
		console.log(`Skipping ${json["Video ID"]} as it already exists...`);
		continue;
	}

	try {
		console.log(`Generating content for ${json["Video ID"]}...`);
		const result = await model.generateContent(
			[
				Deno.readTextFileSync("./extract-data-from-json.md"),
				Deno.readTextFileSync(`./data-from-csv/${file.name}`),
				Deno.readTextFileSync(`./data-from-csv/${json["Video ID"]}.en.vtt`),
			],
			{
				// 3 minutes
				timeout: 180000,
			},
		);

		Deno.writeTextFileSync(
			`./data-from-gemini/${json["Video ID"]}.json`,
			result.response.text(),
		);
	} catch (error) {
		console.error(
			`Failed to generate content for ${
				json["Video ID"]
			} within timeout of 3 minutes`,
		);
		console.error(error);
		continue;
	}

	console.log(`Generated content for ${json["Video ID"]}`);
}
