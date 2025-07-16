import { outputDir } from "./globals.ts";
import {
	downloadUrl,
	generateMasterPlaylist,
	transcodeAll,
} from "./utilities/mod.ts";
import { syncDirectoryToS3 } from "./utilities/rclone.ts";

console.time("transcoding-job");

const decoder = new TextDecoder("utf-8");
const r2JsonBytes = Deno.readFileSync("/secrets/cloudflare-r2");
const r2Json = decoder.decode(r2JsonBytes);

const r2Secrets = JSON.parse(r2Json) as {
	endpoint: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
};

const input = Deno.env.get("VIDEO_ID");

// Download original video from Cloudflare R2
await downloadUrl(
	`https://content.rawkode.academy/videos/${input}/original.mkv`,
	`${outputDir}/original.mkv`,
);

const results = await transcodeAll(new URL(`file://${Deno.cwd()}/${outputDir}/original.mkv`));

// Extract audio from the original video
const audioExtractionCmd = new Deno.Command("ffmpeg", {
	args: [
		"-i",
		`${outputDir}/original.mkv`,
		"-vn", // No video
		"-c:a",
		"libmp3lame", // Re-encode to MP3
		"-b:a", "192k", // Set audio bitrate
		"-y", // Overwrite output file
		`${outputDir}/original.mp3`,
	],
});

const audioResult = await audioExtractionCmd.output();
if (!audioResult.success) {
	console.error("Failed to extract audio from original video");
	console.error(new TextDecoder().decode(audioResult.stderr));
} else {
	console.log(`Audio extracted successfully: original.mp3`);
}

const playlist = await generateMasterPlaylist(results);
Deno.writeTextFile(
  `./${outputDir}/stream.m3u8`,
  playlist,
);

await syncDirectoryToS3(outputDir, {
	bucketName: r2Secrets.bucket,
	endpoint: r2Secrets.endpoint,
	accessKey: r2Secrets.accessKeyId,
	secretKey: r2Secrets.secretAccessKey,
	pathPrefix: `videos/${input}/`,
});

console.log("Transcoding job completed successfully.");
console.timeEnd("transcoding-job");
