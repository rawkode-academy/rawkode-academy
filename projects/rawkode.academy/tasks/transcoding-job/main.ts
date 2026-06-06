import { outputDir } from "./globals.ts";
import {
  downloadFromS3,
  downloadUrl,
  generateMasterPlaylist,
  transcodeAll,
} from "./utilities/mod.ts";
import { syncDirectoryToS3 } from "./utilities/rclone.ts";
import {
  buildTranscodeStatusDocument,
  uploadTranscodeStatus,
} from "./utilities/status.ts";
import { S3Client } from "@aws-sdk/client-s3";

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

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const videoId = requireEnv("VIDEO_ID");
const sourceKey = Deno.env.get("SOURCE_KEY");
const sourceBucket = Deno.env.get("SOURCE_BUCKET") ?? r2Secrets.bucket;
const sourceEtag = Deno.env.get("SOURCE_ETAG");
const sourceFormat = Deno.env.get("SOURCE_FORMAT") ?? "mkv";
const outputPrefix = Deno.env.get("OUTPUT_PREFIX") ?? `videos/${videoId}/`;
const studioSessionId = Deno.env.get("STUDIO_SESSION_ID");
const recordingId = Deno.env.get("RECORDING_ID");
const sourcePath = `${outputDir}/source.${sourceFormat}`;
const originalPath = `${outputDir}/original.mkv`;

const s3 = new S3Client({
  region: "auto",
  endpoint: r2Secrets.endpoint,
  credentials: {
    accessKeyId: r2Secrets.accessKeyId,
    secretAccessKey: r2Secrets.secretAccessKey,
  },
});

const transcodeStatusContext = {
  videoId,
  studioSessionId,
  recordingId,
  sourceBucket,
  sourceKey,
  sourceEtag,
  sourceFormat,
  outputPrefix,
};

try {
  await uploadTranscodeStatus(s3, r2Secrets.bucket, {
    ...transcodeStatusContext,
    status: "running",
    timestamp: new Date().toISOString(),
  }).catch((error) => {
    console.error("Failed to write running transcode status", error);
  });

  await Deno.mkdir(outputDir, { recursive: true });

  if (sourceKey) {
    await downloadFromS3(s3, sourceBucket, sourceKey, sourcePath);
  } else {
    await downloadUrl(
      `https://content.rawkode.academy/videos/${videoId}/original.mkv`,
      originalPath,
    );
  }

  if (sourceKey && sourcePath !== originalPath) {
    const normalizeCmd = new Deno.Command("ffmpeg", {
      args: [
        "-i",
        sourcePath,
        "-map",
        "0",
        "-c",
        "copy",
        "-y",
        originalPath,
      ],
    });
    const normalizeResult = await normalizeCmd.output();
    if (!normalizeResult.success) {
      console.error(new TextDecoder().decode(normalizeResult.stderr));
      throw new Error("Failed to normalize source recording to original.mkv");
    }
  }

  const results = await transcodeAll(
    new URL(`file://${Deno.cwd()}/${originalPath}`),
  );

  // Extract audio from the original video
  const audioExtractionCmd = new Deno.Command("ffmpeg", {
    args: [
      "-i",
      `${outputDir}/original.mkv`,
      "-vn", // No video
      "-c:a",
      "libmp3lame", // Re-encode to MP3
      "-b:a",
      "192k", // Set audio bitrate
      "-y", // Overwrite output file
      `${outputDir}/original.mp3`,
    ],
  });

  const audioResult = await audioExtractionCmd.output();
  if (!audioResult.success) {
    console.error("Failed to extract audio from original video");
    console.error(new TextDecoder().decode(audioResult.stderr));
    throw new Error("Failed to extract audio from original video");
  } else {
    console.log(`Audio extracted successfully: original.mp3`);
  }

  const playlist = await generateMasterPlaylist(results);
  await Deno.writeTextFile(
    `./${outputDir}/stream.m3u8`,
    playlist,
  );

  await Deno.writeTextFile(
    `./${outputDir}/transcode-status.json`,
    JSON.stringify(
      buildTranscodeStatusDocument({
        ...transcodeStatusContext,
        status: "complete",
        timestamp: new Date().toISOString(),
      }),
      null,
      2,
    ),
  );

  await syncDirectoryToS3(outputDir, {
    bucketName: r2Secrets.bucket,
    endpoint: r2Secrets.endpoint,
    accessKey: r2Secrets.accessKeyId,
    secretKey: r2Secrets.secretAccessKey,
    pathPrefix: outputPrefix,
  });

  console.log("Transcoding job completed successfully.");
} catch (error) {
  console.error("Transcoding job failed", error);
  await uploadTranscodeStatus(s3, r2Secrets.bucket, {
    ...transcodeStatusContext,
    status: "failed",
    timestamp: new Date().toISOString(),
    error,
  }).catch((statusError) => {
    console.error("Failed to write failed transcode status", statusError);
  });
  throw error;
} finally {
  console.timeEnd("transcoding-job");
}
