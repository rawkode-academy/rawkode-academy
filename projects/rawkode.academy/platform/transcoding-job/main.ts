import { S3Client } from "@aws-sdk/client-s3";
import {
  downloadUrl,
  generateMasterPlaylist,
  transcodeAll,
} from "./utilities/mod.ts";
import { uploadDirectoryToS3, uploadToS3 } from "./utilities/s3.ts";

console.time("transcoding-job");

const decoder = new TextDecoder("utf-8");
const s3JsonBytes = Deno.readFileSync("/secrets/scaleway-s3");
const s3Json = decoder.decode(s3JsonBytes);

const s3Secrets = JSON.parse(s3Json) as {
  accessKeyId: string;
  secretAccessKey: string;
};

const s3Client = new S3Client({
  region: "auto",
  endpoint: "https://s3.nl-ams.scw.cloud",
  credentials: {
    accessKeyId: s3Secrets.accessKeyId,
    secretAccessKey: s3Secrets.secretAccessKey,
  },
});

const input = Deno.env.get("VIDEO_ID");

// Download original video from Cloudflare R2
await downloadUrl(
  `https://videos.rawkode.academy/${input}/youtube/video.mkv`,
  `${input}.mkv`,
);

// Upload original video to Scaleway S3
await uploadToS3(
  s3Client,
  "content.rawkode.academy",
  `${input}.mkv`,
  `videos/${input}/original.mkv`,
);

const results = await transcodeAll(new URL(`${input}.mkv`, import.meta.url));

const playlist = await generateMasterPlaylist(results);
Deno.writeTextFile(
  `./transcoded/stream.m3u8`,
  playlist,
);

// Upload transcoded videos to Scaleway S3
await uploadDirectoryToS3(
  s3Client,
  "content.rawkode.academy",
  "transcoded",
  `videos/${input}/`,
);
