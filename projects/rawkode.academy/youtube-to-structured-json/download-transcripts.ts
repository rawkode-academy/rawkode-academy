import { $ } from "zx";

// loop over every json file in ./data-from-csv
for (const file of Deno.readDirSync("./data-from-csv")) {
	const json = JSON.parse(await Deno.readTextFile(`./data-from-csv/${file.name}`));

	if (json['Privacy'] === "Private") {
		console.log(`Skipping ${json['Video ID']} because it is private`);
		continue;
	}

	console.log(`Downloading transcript for ${json['Video ID']}`);
	await $`yt-dlp -o "./data-from-csv/%(id)s.%(ext)s" --write-auto-sub --sub-lang en --skip-download --sub-format vtt  https://www.youtube.com/watch?v=${json['Video ID']}`;
};
