import {
	PutObjectCommand,
	PutObjectCommandInput,
	S3Client,
} from "@aws-sdk/client-s3";
import { createId } from "@paralleldrive/cuid2";
import { existsSync } from "@std/fs";

const cloudflareR2 = {
	accountId: "0aeb879de8e3cdde5fb3d413025222ce",
	accessKey: Deno.env.get("CLOUDFLARE_R2_ACCESS_KEY")!,
	secretKey: Deno.env.get("CLOUDFLARE_R2_SECRET_KEY")!,
};

const s3 = new S3Client({
	region: "auto",
	endpoint: `https://${cloudflareR2.accountId}.eu.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: cloudflareR2.accessKey,
		secretAccessKey: cloudflareR2.secretKey,
	},
});

const mimeType = (filename: string) => {
	switch (filename.split(".").pop()) {
		case "mkv":
			return "video/x-matroska";
		case "jpg":
			return "image/jpeg";
		case "json":
			return "application/json";
		case "wav":
			return "audio/wav";
		case "txt":
			return "text/plain";
		default:
			return "application/octet-stream";
	}
};

const uploadToR2 = async (local: string, remote: string) => {
	console.log(`R2 Uploading ${local} to ${remote}...`);

	const bytes = Deno.readFileSync(local);
	const uploadCommand: PutObjectCommandInput = {
		Bucket: "rawkode-academy-videos",
		Key: remote,
		Body: bytes,
		ContentLength: bytes.length,
		ContentType: mimeType(remote),
		IfNoneMatch: "*",
	};

	try {
		const s3Command = new PutObjectCommand(uploadCommand);
		await s3.send(s3Command);
		console.log(`File ${local} uploaded to ${remote}.`);
	} catch (error) {
		console.log(`Potentially skipping upload: ${error}`);
	}
};

const downloadVideo = async (youtubeId: string, cuid2: string) => {
	if (!existsSync(`./pipeline/${youtubeId}/video.mkv`)) {
		console.log("Downloading video...");

		// Download best video and audio streams separately (no merge)
		new Deno.Command("yt-dlp", {
			args: [
				"-f",
				"bestvideo+bestaudio",
				"--remux-video",
				"mkv",
				"-o",
				`./pipeline/${youtubeId}/video.%(ext)s`,
				`https://www.youtube.com/watch?v=${youtubeId}`,
			],
		}).outputSync();
	}

	await uploadToR2(
		`./pipeline/${youtubeId}/video.mkv`,
		`${cuid2}/youtube/video.mkv`,
	);
};

const downloadThumbnail = async (youtubeId: string, cuid2: string) => {
	if (!existsSync(`./pipeline/${youtubeId}/thumbnail.jpg`)) {
		// Download thumbnail
		new Deno.Command("yt-dlp", {
			args: [
				"--write-thumbnail",
				"--skip-download",
				"--convert-thumbnails",
				"jpg",
				"-o",
				`./pipeline/${youtubeId}/thumbnail`,
				`https://www.youtube.com/watch?v=${youtubeId}`,
			],
		}).outputSync();
	}

	await uploadToR2(
		`./pipeline/${youtubeId}/thumbnail.jpg`,
		`${cuid2}/thumbnail.jpg`,
	);
};

const downloadMetadata = async (youtubeId: string, cuid2: string) => {
	if (!existsSync(`./pipeline/${youtubeId}/metadata.info.json`)) {
		// Download metadata as JSON
		new Deno.Command("yt-dlp", {
			args: [
				"--write-info-json",
				"--skip-download",
				"-o",
				`./pipeline/${youtubeId}/metadata`,
				`https://www.youtube.com/watch?v=${youtubeId}`,
			],
		}).outputSync();
	}

	await uploadToR2(
		`./pipeline/${youtubeId}/metadata.info.json`,
		`${cuid2}/youtube/metadata.json`,
	);
};

const downloadDescription = async (youtubeId: string, cuid2: string) => {
	if (!existsSync(`./pipeline/${youtubeId}/description`)) {
		// Download Description if available
		new Deno.Command("yt-dlp", {
			args: [
				"--write-description",
				"--skip-download",
				"-o",
				`./pipeline/${youtubeId}/description`,
				`https://www.youtube.com/watch?v=${youtubeId}`,
			],
		}).outputSync();
	}

	await uploadToR2(
		`./pipeline/${youtubeId}/description.description`,
		`${cuid2}/youtube/description.txt`,
	);
};

const getAudioFromVideo = async (youtubeId: string, cuid2: string) => {
	if (existsSync(`./pipeline/${youtubeId}/audio.wav`)) {
		return;
	}

	// Get audio from video file
	console.log("Extracting audio...");
	new Deno.Command(
		"ffmpeg",
		{
			args: [
				"-i",
				`./pipeline/${youtubeId}/video.mkv`,
				"-vn",
				"-acodec",
				"pcm_s16le",
				"-ar",
				"16000",
				"-ac",
				"1",
				`./pipeline/${youtubeId}/audio.wav`,
			],
		},
	).outputSync();

	await uploadToR2(
		`./pipeline/${youtubeId}/audio.wav`,
		`${cuid2}/youtube/audio.wav`,
	);
};

const downloadTranscript = async (youtubeId: string, cuid2: string) => {
	if (existsSync(`./pipeline/${youtubeId}/transcript.json`)) {
		return;
	}

	// Download transcript
	new Deno.Command("yt-dlp", {
		args: [
			"--write-auto-sub",
			"--sub-lang",
			"en",
			"--skip-download",
			"--sub-format",
			"vtt",
			"-o",
			`./pipeline/${youtubeId}/transcript`,
			`https://www.youtube.com/watch?v=${youtubeId}`,
		],
	}).outputSync();

	if (!existsSync(`./pipeline/${youtubeId}/transcript.en.vtt`)) {
		return;
	}

	await uploadToR2(
		`./pipeline/${youtubeId}/transcript.en.vtt`,
		`${cuid2}/youtube/transcript.en.vtt`,
	);
};

// loop over every json file in ./data-from-csv
for (const file of Deno.readDirSync("./data-from-csv")) {
	if (!file.name.endsWith(".json")) {
		continue;
	}

	const json = JSON.parse(
		await Deno.readTextFile(`./data-from-csv/${file.name}`),
	);

	if (existsSync(`./pipeline/${json["Video ID"]}/done`)) {
		console.log(`Skipping ${file.name} as it's been processed...`);
		continue;
	}

	const youtubeId = json["Video ID"];

	Deno.mkdirSync(`./pipeline/${youtubeId}`, { recursive: true });

	if (!existsSync(`./pipeline/${youtubeId}/cuid2.txt`)) {
		Deno.writeTextFileSync(
			`./pipeline/${json["Video ID"]}/cuid2.txt`,
			createId(),
		);
	}

	const cuid2 = Deno.readTextFileSync(
		`./pipeline/${json["Video ID"]}/cuid2.txt`,
	);

	console.log(`Processing ${youtubeId} with ${cuid2}...`);

	await downloadVideo(youtubeId, cuid2);

	await downloadThumbnail(youtubeId, cuid2);

	await downloadMetadata(youtubeId, cuid2);

	await downloadDescription(youtubeId, cuid2);

	await downloadTranscript(youtubeId, cuid2);

	await getAudioFromVideo(youtubeId, cuid2);

	// await trimVideo(youtubeId, cuid2);

	Deno.writeTextFileSync(`./pipeline/${youtubeId}/done`, "");
}
