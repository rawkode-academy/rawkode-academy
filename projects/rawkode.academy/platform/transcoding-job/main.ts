import { outputDir } from "./globals.ts";
import {
	downloadUrl,
	generateMasterPlaylist,
	transcodeAll,
} from "./utilities/mod.ts";
import { syncDirectoryToS3 } from "./utilities/rclone.ts";

console.time("transcoding-job");

const decoder = new TextDecoder("utf-8");
const s3JsonBytes = Deno.readFileSync("/secrets/scaleway-s3");
const s3Json = decoder.decode(s3JsonBytes);

const s3Secrets = JSON.parse(s3Json) as {
  accessKeyId: string;
  secretAccessKey: string;
};

const input = Deno.env.get("VIDEO_ID");

// Download original video from Cloudflare R2
await downloadUrl(
  `https://videos.rawkode.academy/${input}/youtube/video.mkv`,
  `${outputDir}/${input}.mkv`,
);

const results = await transcodeAll(new URL(`${input}.mkv`, import.meta.url));

const playlist = await generateMasterPlaylist(results);
Deno.writeTextFile(
  `./${outputDir}/stream.m3u8`,
  playlist,
);

await syncDirectoryToS3(
  outputDir,
  {
    bucketName: "content.rawkode.academy",
    endpoint: "https://s3.nl-ams.scw.cloud",
    accessKey: s3Secrets.accessKeyId,
    secretKey: s3Secrets.secretAccessKey,
    pathPrefix: `videos/${input}/`,
  },
);

console.log("Transcoding job completed successfully.");
console.timeEnd("transcoding-job");
