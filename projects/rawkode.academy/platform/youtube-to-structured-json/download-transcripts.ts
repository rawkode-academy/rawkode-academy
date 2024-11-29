import { $ } from "zx";
import { existsSync } from "@std/fs";

// loop over every json file in ./data-from-csv
for (const file of Deno.readDirSync("./data-from-csv")) {
	if (!file.name.endsWith(".json")) {
		continue;
	}

	const json = JSON.parse(
		await Deno.readTextFile(`./data-from-csv/${file.name}`),
	);

	if (existsSync(`./data-from-csv/${json["Video ID"]}.en.vtt`)) {
		console.log(`Skipping ${file.name} as it already exists...`);
		continue;
	}

	if (json["Privacy"] === "Private") {
		console.log(`Skipping ${json["Video ID"]} because it is private`);
		continue;
	}

	try {
		console.log(`Downloading transcript for ${json["Video ID"]}`);
		await $`yt-dlp -o "./data-from-csv/%(id)s.%(ext)s" --write-auto-sub --sub-lang en --skip-download --sub-format vtt  https://www.youtube.com/watch?v=${
			json["Video ID"]
		}`;
	} catch (error) {
		console.error(`Failed to download transcript for ${json["Video ID"]}`);
		console.error(error);
		continue;
	}
}
