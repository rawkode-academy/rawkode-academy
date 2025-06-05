import { uploadFile } from "./utilities/s3.ts";
import { downloadUrl } from "./utilities/http.ts";

console.time("mp3-extraction-job");

const decoder = new TextDecoder("utf-8");
const r2JsonBytes = Deno.readFileSync("/secrets/cloudflare-r2");
const r2Json = decoder.decode(r2JsonBytes);

const r2Secrets = JSON.parse(r2Json) as {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

const videoId = Deno.env.get("VIDEO_ID");

if (!videoId) {
  console.error("VIDEO_ID environment variable is required");
  Deno.exit(1);
}

const outputDir = "./output";

// Create output directory
await Deno.mkdir(outputDir, { recursive: true });

const inputPath = `${outputDir}/${videoId}.mkv`;
const outputPath = `${outputDir}/${videoId}.mp3`;

try {
  // Download original video from Cloudflare R2 public URL
  console.log(`Downloading video ${videoId} from R2...`);
  
  // First try to download {videoId}.mkv
  try {
    await downloadUrl(
      `https://content.rawkode.academy/videos/${videoId}/${videoId}.mkv`,
      inputPath,
    );
  } catch (error) {
    console.log(`${videoId}.mkv not found, trying original.mkv...`);
    // If that fails, try original.mkv
    await downloadUrl(
      `https://content.rawkode.academy/videos/${videoId}/original.mkv`,
      inputPath,
    );
  }

  // Extract audio using ffmpeg
  console.log(`Extracting audio from video ${videoId}...`);
  const ffmpegCmd = new Deno.Command("ffmpeg", {
    args: [
      "-i",
      inputPath,
      "-vn", // No video
      "-acodec",
      "libmp3lame", // Use MP3 codec
      "-ab",
      "192k", // Audio bitrate
      "-ar",
      "44100", // Sample rate
      "-y", // Overwrite output file
      outputPath,
    ],
  });

  const { code, stderr } = await ffmpegCmd.output();

  if (code !== 0) {
    console.error("Failed to extract audio from video");
    console.error(new TextDecoder().decode(stderr));
    throw new Error(`ffmpeg failed with code ${code}`);
  }

  console.log(`Audio extracted successfully: ${videoId}.mp3`);

  // Upload MP3 back to R2
  console.log(`Uploading MP3 for video ${videoId} to R2...`);
  await uploadFile({
    bucket: r2Secrets.bucket,
    key: `videos/${videoId}/${videoId}.mp3`,
    endpoint: r2Secrets.endpoint,
    accessKeyId: r2Secrets.accessKeyId,
    secretAccessKey: r2Secrets.secretAccessKey,
    filePath: outputPath,
    contentType: "audio/mpeg",
  });

  console.log(`MP3 extraction job completed successfully for video ${videoId}`);
} catch (error) {
  console.error("Error in MP3 extraction job:", error);
  Deno.exit(1);
} finally {
  // Clean up temporary files
  try {
    await Deno.remove(outputDir, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
}

console.timeEnd("mp3-extraction-job");
