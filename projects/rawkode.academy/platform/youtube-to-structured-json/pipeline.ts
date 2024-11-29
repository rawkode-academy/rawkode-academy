import { webvtt } from "@deepgram/captions";
import { createClient } from "@deepgram/sdk";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { existsSync } from "@std/fs";
import { Buffer } from "node:buffer";

const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;
const genAI = new GoogleGenerativeAI(geminiApiKey);

const deepgram = createClient(Deno.env.get("DEEPGRAM_API_KEY")!);

const bunnyApiKey = Deno.env.get("BUNNY_API_KEY")!;

const downloadVideo = async (id: string) => {
	if (existsSync(`./pipeline/${id}/video.mkv`)) {
		return;
	}

	console.log("Downloading video...");

	// Download best video and audio streams separately (no merge)
	await new Deno.Command("yt-dlp", {
		args: [
			"-f",
			"bestvideo+bestaudio",
			"--remux-video",
			"mkv",
			"-o",
			`./pipeline/${id}/video.%(ext)s`,
			`https://www.youtube.com/watch?v=${id}`,
		],
	}).outputSync();

	// Download thumbnail
	await new Deno.Command("yt-dlp", {
		args: [
			"--write-thumbnail",
			"--skip-download",
			"--convert-thumbnails",
			"jpg",
			"-o",
			`./pipeline/${id}/thumbnail`,
			`https://www.youtube.com/watch?v=${id}`,
		],
	}).outputSync();

	// Download metadata as JSON
	await new Deno.Command("yt-dlp", {
		args: [
			"--write-info-json",
			"--skip-download",
			"-o",
			`./pipeline/${id}/metadata`,
			`https://www.youtube.com/watch?v=${id}`,
		],
	}).outputSync();

	// Download Description if available
	await new Deno.Command("yt-dlp", {
		args: [
			"--write-description",
			"--skip-download",
			"-o",
			`./pipeline/${id}/description`,
			`https://www.youtube.com/watch?v=${id}`,
		],
	}).outputSync();
};

const getAudioFromVideo = async (id: string) => {
	if (existsSync(`./pipeline/${id}/audio.mka`)) {
		return;
	}

	// Get audio from video file
	console.log("Extracting audio...");
	await new Deno.Command(
		"ffmpeg",
		{
			args: [
				"-i",
				`./pipeline/${id}/video.mkv`,
				"-map",
				"0:a",
				"-c",
				"copy",
				`./pipeline/${id}/audio.mka`,
			],
		},
	).outputSync();
};

const firstLastWords = {
	type: SchemaType.OBJECT,
	properties: {
		firstWordTimestamp: {
			type: SchemaType.STRING,
			description: "When is the first word said?",
		},
		lastWordTimestamp: {
			type: SchemaType.STRING,
			description: "When is the last word said?",
		},
	},
};

const transcribeAudio = async (id: string): Promise<boolean> => {
	if (existsSync(`./pipeline/${id}/audio.json`)) {
		return true;
	}

	console.log("Transcribing audio...");
	const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
		Buffer.from(Deno.readFileSync(`./pipeline/${id}/audio.mka`)),
		{
			model: "nova-2",
			detect_topics: true,
			detect_entities: true,
			detect_language: true,
			language: "en-US",
			profanity_filter: false,
			punctuate: true,
			summarize: true,
			paragraphs: true,
			keywords: Deno.readFileSync("./glossary.txt").toString().split("\n"),
		},
	);

	if (error) {
		console.error(error);
		return false;
	}

	Deno.writeFileSync(
		`./pipeline/${id}/audio.json`,
		new TextEncoder().encode(JSON.stringify(result)),
	);

	const captions = webvtt(result);

	Deno.writeFileSync(
		`./pipeline/${id}/audio.en.vtt`,
		new TextEncoder().encode(captions),
	);
	return true;
};

const determinateFirstLastWords = async (id: string): Promise<boolean> => {
	if (existsSync(`./pipeline/${id}/first-last-words.json`)) {
		return true;
	}

	console.log("Finding first and last words...");

	const audio = Deno.readTextFileSync(`./pipeline/${id}/audio.en.vtt`);

	const model = genAI.getGenerativeModel({
		model: "gemini-1.5-flash-latest",
		generationConfig: {
			responseMimeType: "application/json",
			responseSchema: firstLastWords,
		},
	});

	try {
		const result = await model.generateContent(
			[
				`Here are subtitles for a video.

				We need the exact timestamp for the first spoken word and the last spoken word.

				To ensure we trim the video correctly, give a 300ms buffer on either side.

				Subtitles: ${audio}`,
			],
			{
				timeout: 180000,
			},
		);

		Deno.writeTextFileSync(
			`./pipeline/${id}/first-last-words.json`,
			result.response.text(),
		);
	} catch (error) {
		console.error(error);
		return false;
	}

	return true;
};

const trimVideo = async (id: string) => {
	if (existsSync(`./pipeline/${id}/video-trim.mkv`)) {
		return;
	}

	const json = JSON.parse(
		await Deno.readTextFile(`./pipeline/${id}/first-last-words.json`),
	);

	const start = json.firstWordTimestamp;
	const end = json.lastWordTimestamp;

	console.log("Trimming video...");

	await new Deno.Command(
		"ffmpeg",
		{
			args: [
				"-i",
				`./pipeline/${id}/video.mkv`,
				"-ss",
				start,
				"-to",
				end,
				"-c",
				"copy",
				`./pipeline/${id}/video-trim.mkv`,
			],
		},
	).outputSync();
};

const deleteBunnyVideo = (id: string) => {
	console.log(`Deleting video ${id} from Bunny.net...`);

	new Deno.Command(
		"curl",
		{
			args: [
				"--request",
				"DELETE",
				"--url",
				`https://video.bunnycdn.com/library/345630/videos/${json.guid}`,
				"--header",
				`AccessKey: ${bunnyApiKey}`,
				"--header",
				"accept: application/json",
				"--header",
				"content-type: application/json",
			],
		},
	).outputSync();
}

interface BunnyResponse {
	guid: string;
}

const uploadToBunny = (id: string): boolean => {
	if (existsSync(`./pipeline/${id}/bunny.json`)) {
		return true;
	}

	const title = JSON.parse(
		Deno.readTextFileSync(`./pipeline/${id}/metadata.info.json`),
	).title;

	console.log("Uploading to Bunny.net...");

	const response = new Deno.Command(
		"curl",
		{
			args: [
				"--request",
				"POST",
				"--url",
				"https://video.bunnycdn.com/library/345630/videos",
				"--header",
				`AccessKey: ${bunnyApiKey}`,
				"--header",
				"accept: application/json",
				"--header",
				"content-type: application/json",
				"--data",
				`{"title":"${title}"}`,
			],
		},
	).outputSync();

	if (!response.success) {
		return false;
	}

	const json = JSON.parse(
		new TextDecoder().decode(response.stdout),
	) as BunnyResponse;

	Deno.writeTextFileSync(
		`./pipeline/${id}/bunny.json`,
		JSON.stringify(json),
	);

	console.log(`Uploading thumbnail for ${json.guid}...`);

	const thumbnailResponse = new Deno.Command(
		"curl",
		{
			args: [
				"--request",
				"POST",
				"--url",
				`https://video.bunnycdn.com/library/345630/videos/${json.guid}/thumbnail`,
				"--header",
				`AccessKey: ${bunnyApiKey}`,
				"--header",
				"accept: application/json",
				"--header",
				"content-type: application/json",
				"--data-binary",
				`@./pipeline/${id}/thumbnail.jpg`,
			],
		},
	).outputSync();

	if (!thumbnailResponse.success) {
		Deno.removeSync(`./pipeline/${id}/bunny.json`);
		deleteBunnyVideo(json.guid);
		return false;
	}

	console.log(`Uploading video for ${json.guid}...`);

	const uploadResponse = new Deno.Command(
		"curl",
		{
			args: [
				"--request",
				"PUT",
				"--url",
				`https://video.bunnycdn.com/library/345630/videos/${json.guid}`,
				"--header",
				`AccessKey: ${bunnyApiKey}`,
				"--header",
				"accept: application/json",
				"--header",
				"content-type: application/json",
				"--data-binary",
				`@./pipeline/${id}/video-trim.mkv`,
			],
		},
	).outputSync();

	if (!uploadResponse.success) {
		deleteBunnyVideo(json.guid);
		Deno.removeSync(`./pipeline/${id}/bunny.json`);
		return false;
	}

	return true;
};

// loop over every json file in ./data-from-csv
for (const file of Deno.readDirSync("./data-from-csv")) {
	if (!file.name.endsWith(".json")) {
		continue;
	}

	const json = JSON.parse(
		await Deno.readTextFile(`./data-from-csv/${file.name}`),
	);

	if (existsSync(`./data-from-csv/${json["Video ID"]}.done`)) {
		console.log(`Skipping ${file.name} as it's been processed...`);
		continue;
	}

	const videoId = json["Video ID"];

	console.log(`Processing ${videoId}...`);

	Deno.mkdirSync(`./pipeline/${videoId}`, { recursive: true });

	await downloadVideo(videoId);

	await getAudioFromVideo(videoId);

	if (!(await transcribeAudio(videoId))) {
		continue;
	}

	await determinateFirstLastWords(videoId);

	await trimVideo(videoId);

	await uploadToBunny(videoId);

	Deno.writeFileSync(
		`./data-from-csv/${json["Video ID"]}.done`,
		new TextEncoder().encode(""),
	);
}
