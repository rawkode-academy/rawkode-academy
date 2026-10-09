import { outputDir } from "./globals.ts";
import {
  downloadFromS3,
  downloadFromS3ToFile,
  downloadUrl,
  generateMasterPlaylist,
  getDurationMs,
  transcodeAll,
  uploadPrivateOnce,
} from "./utilities/mod.ts";
import {
  isPrivateWorkFile,
  MAX_REVIEW_OUTPUT_BYTES,
  maxReviewSourceBytes,
  parseOutputMode,
  reviewFfmpegArgs,
  reviewOutputKey,
  sha256File,
} from "./utilities/review.ts";
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
const outputMode = parseOutputMode(Deno.env.get("OUTPUT_MODE"));
const approved = outputMode === "hls-approved";
// outputDir is copied to the output prefix. The Studio review modes keep the raw
// source and original.mkv in a private work directory that is never uploaded.
const workDir = outputMode === "hls" ? outputDir : "work";
const sourcePath = `${workDir}/source.${sourceFormat}`;
const originalPath = `${workDir}/original.mkv`;

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
  ...(outputMode === "hls" ? {} : { outputMode }),
};

// Private 720p H.264/AAC proxy for Payload review, pinned to SOURCE_ETAG.
async function runReviewProxy(): Promise<void> {
  if (!sourceKey || !sourceEtag) {
    throw new Error("review-proxy requires SOURCE_KEY and SOURCE_ETAG");
  }
  const execution = Deno.env.get("CLOUD_RUN_EXECUTION") ??
    `local-${crypto.randomUUID()}`;
  const attempt = Deno.env.get("CLOUD_RUN_TASK_ATTEMPT") ?? "0";
  const reviewKey = reviewOutputKey(outputPrefix, execution, attempt);
  const reviewPath = `${workDir}/review.mp4`;
  await Deno.mkdir(workDir, { recursive: true });
  await downloadFromS3ToFile(s3, sourceBucket, sourceKey, sourcePath, {
    ifMatch: sourceEtag,
    maxBytes: maxReviewSourceBytes(Deno.env.get("MAX_REVIEW_SOURCE_BYTES")),
  });
  const encode = await new Deno.Command("ffmpeg", {
    args: reviewFfmpegArgs(sourcePath, reviewPath),
    stdout: "null",
    stderr: "piped",
  }).output();
  if (!encode.success) {
    console.error(new TextDecoder().decode(encode.stderr));
    throw new Error("Failed to encode the review proxy");
  }
  // The filesystem is memory-backed; release the source before hashing and upload.
  await Deno.remove(sourcePath);
  const bytes = (await Deno.stat(reviewPath)).size;
  if (bytes > MAX_REVIEW_OUTPUT_BYTES) {
    throw new Error(
      `Review proxy is ${bytes} bytes, above the single PutObject limit`,
    );
  }
  const [durationMs, sha256] = await Promise.all([
    getDurationMs(reviewPath),
    sha256File(reviewPath),
  ]);
  const uploaded = await uploadPrivateOnce(
    s3,
    r2Secrets.bucket,
    reviewPath,
    reviewKey,
    "video/mp4",
  );
  await uploadTranscodeStatus(s3, r2Secrets.bucket, {
    ...transcodeStatusContext,
    status: "complete",
    timestamp: new Date().toISOString(),
    review: {
      key: reviewKey,
      etag: uploaded.etag,
      bytes: uploaded.bytes,
      sha256,
      durationMs,
      contentType: "video/mp4",
    },
  });
  console.log(`Review proxy written to ${reviewKey}.`);
}

// Public HLS: the original VOD path, or an approved Studio review recording.
async function runHls(): Promise<void> {
  await Deno.mkdir(outputDir, { recursive: true });
  if (workDir !== outputDir) {
    await Deno.mkdir(workDir, { recursive: true });
  }

  if (sourceKey && approved) {
    await downloadFromS3ToFile(s3, sourceBucket, sourceKey, sourcePath, {
      ifMatch: requireEnv("SOURCE_ETAG"),
    });
  } else if (sourceKey) {
    await downloadFromS3(s3, sourceBucket, sourceKey, sourcePath);
  } else if (approved) {
    throw new Error("hls-approved requires SOURCE_KEY");
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
      originalPath,
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

  if (approved) {
    for await (const entry of Deno.readDir(outputDir)) {
      if (isPrivateWorkFile(entry.name)) {
        throw new Error(`Refusing to publish private file ${entry.name}`);
      }
    }
  }

  await syncDirectoryToS3(outputDir, {
    bucketName: r2Secrets.bucket,
    endpoint: r2Secrets.endpoint,
    accessKey: r2Secrets.accessKeyId,
    secretKey: r2Secrets.secretAccessKey,
    pathPrefix: outputPrefix,
  });
}

try {
  await uploadTranscodeStatus(s3, r2Secrets.bucket, {
    ...transcodeStatusContext,
    status: "running",
    timestamp: new Date().toISOString(),
  }).catch((error) => {
    console.error("Failed to write running transcode status", error);
  });

  if (outputMode === "review-proxy") {
    await runReviewProxy();
  } else {
    await runHls();
  }

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
