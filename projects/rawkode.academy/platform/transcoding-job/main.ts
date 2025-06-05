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
	`https://videos.rawkode.academy/${input}/original.mkv`,
	`${outputDir}/${input}.mkv`,
);

const results = await transcodeAll(new URL(`${input}.mkv`, import.meta.url));

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
