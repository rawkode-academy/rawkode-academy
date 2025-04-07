import { basename, extname, join } from "@std/path";
import ffmpeg from "fluent-ffmpeg";

type Resolution = [width: number, height: number];

type Preset = {
  resolution: number;
  bitrate: number;
};

const presets: Preset[] = [
  { resolution: 2160, bitrate: 15000 },
  { resolution: 1440, bitrate: 10000 },
  { resolution: 1080, bitrate: 8000 },
  { resolution: 720, bitrate: 5000 },
  { resolution: 480, bitrate: 2500 },
  { resolution: 360, bitrate: 1000 },
];

type TranscodeResult = {
  width: number;
  height: number;
  m3u8Path: string;
  m3u8Filename: string;
  bitrate: number;
};

export const getResolution = (localFile: string): Promise<Resolution> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(localFile, (err, metadata) => {
      if (err) {
        return reject(err);
      }

      const video_stream = metadata.streams.find(
        (stream) => stream.codec_type === "video",
      );

      if (!video_stream || !video_stream.width || !video_stream.height) {
        return reject(
          new Error("Could not find video stream or resolution information."),
        );
      }

      resolve([video_stream.width, video_stream.height]);
    });
  });
};

export const generatePlaylist = (transcodeResults: TranscodeResult[]) => {
  const playlist = [
    `#EXTM3U`,
    `#EXT-X-VERSION:3`,
  ];
  for (const result of transcodeResults) {
    console.log(
      `generating ${result.height}p playlist. Path: ${result.height}p/${result.m3u8Path}`,
    );
    playlist.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${
        result.bitrate * 1000
      },RESOLUTION=${result.width}x${result.height}`,
    );
    playlist.push(result.m3u8Filename);
  }
  return playlist.join("\n");
};

export const transcode = async ( // Make the outer function async
  inputUrl: URL,
  preset: Preset,
): Promise<TranscodeResult> => {
  const inputPathname = decodeURI(inputUrl.pathname);
  const inputExtension = extname(inputPathname);
  const inputFilenameBase = basename(inputPathname, inputExtension);
  const baseOutputDir = "transcoded";
  const resolutionOutputDir = join(baseOutputDir, `${preset.resolution}p`);
  const m3u8Filename = `stream.m3u8`;
  const m3u8Path = join(resolutionOutputDir, m3u8Filename);
  const segmentPathPattern = join(
    resolutionOutputDir,
    "%04d.ts",
  );

  console.log(`Input: ${inputPathname}`);
  console.log(`Output Dir: ${resolutionOutputDir}`);
  console.log(`M3U8 Path: ${m3u8Path}`);
  console.log(`Segment Pattern: ${segmentPathPattern}`);
  console.log(
    `Transcoding ${inputFilenameBase} to ${preset.resolution}p...`,
  );

  try {
    await Deno.mkdir(resolutionOutputDir, { recursive: true });
    console.log(`Ensured directory exists: ${resolutionOutputDir}`);
  } catch (mkdirError) {
    console.error(
      `Error creating directory ${resolutionOutputDir}:`,
      mkdirError,
    );
    // Rethrow or handle appropriately. Since this function returns a Promise,
    // throwing here will cause the promise returned by transcode to reject.
    throw new Error(
      `Failed to create output directory: ${
        mkdirError instanceof Error ? mkdirError.message : String(mkdirError)
      }`,
    );
  }

  return new Promise<TranscodeResult>((resolve, reject) => { // Remove async from executor
    // ffmpeg setup starts here, inside the promise executor
    ffmpeg(inputPathname)
      .videoCodec("libx264") // Using libx264 as libx265 might not be universally supported
      .audioCodec("aac")
      .videoBitrate(`${preset.bitrate}k`)
      .audioBitrate("128k")
      .outputOptions([
        "-filter:v",
        `scale=-2:${preset.resolution}`,
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-g",
        "48",
        "-keyint_min",
        "48",
        "-sc_threshold",
        "0",
        "-hls_time",
        "4",
        "-hls_playlist_type",
        "vod",
        "-hls_segment_filename",
        segmentPathPattern,
      ])
      .output(m3u8Path)
      .on("start", (cmdline) => {
        console.log(`FFmpeg (${preset.resolution}p) started.`);
        console.log(cmdline);
      })
      .on("codecData", function (data) {
        console.log(
          "Input is " + data.audio + " audio " +
            "with " + data.video + " video",
        );
      })
      .on("end", () => { // Remove async from here
        console.log(
          `FFmpeg (${preset.resolution}p) finished successfully. Verifying resolution...`,
        );
        getResolution(m3u8Path)
          .then(([width, height]) => {
            console.log(
              `Resolution verified for ${m3u8Path}: ${width}x${height}`,
            );
            resolve({
              width,
              height,
              m3u8Path: m3u8Path, // Use path calculated outside
              m3u8Filename: m3u8Filename, // Use filename calculated outside
              bitrate: preset.bitrate,
            });
          })
          .catch((resolutionError) => {
            console.error(
              `Error getting resolution for ${m3u8Path} after transcode:`,
              resolutionError,
            );
            const errorMessage = resolutionError instanceof Error
              ? resolutionError.message
              : String(resolutionError);
            reject(
              new Error(
                `Transcode succeeded but failed to get resolution for ${m3u8Path}: ${errorMessage}`,
              ),
            );
          });
      })
      .on("error", (err, stderr) => {
        // Ensure err is treated as Error type for message access
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`FFmpeg (${preset.resolution}p) error:`, errMsg);
        console.error("FFmpeg stderr:", stderr); // Log stderr for detailed info
        reject(
          new Error(
            `FFmpeg error during ${preset.resolution}p transcode: ${errMsg}\nStderr: ${stderr}`,
          ),
        );
      })
      .run();
  });
};

export const transcodeAll = async (
  inputUrl: URL,
): Promise<TranscodeResult[]> => {
  const inputPathname = decodeURI(inputUrl.pathname);
  console.log(
    `Starting transcoding for all suitable presets for: ${inputPathname}`,
  );

  // 1. Get the original resolution
  const [originalWidth, originalHeight] = await getResolution(inputPathname);
  console.log(`Original resolution: ${originalWidth}x${originalHeight}`);

  // 2. Filter presets to only include those <= original height
  const suitablePresets = presets.filter((preset) =>
    preset.resolution <= originalHeight
  );

  if (suitablePresets.length === 0) {
    console.log(
      `No presets are lower than or equal to the original height (${originalHeight}p). No transcoding needed.`,
    );
    // Optionally, consider transcoding at original resolution if no presets match,
    // but for now, we'll just return an empty array as no standard presets apply.
    return [];
  }

  console.log(
    `Suitable presets for ${originalHeight}p input: ${
      suitablePresets.map((p) => p.resolution + "p").join(", ")
    }`,
  );

  // 3. Create an array of promises using only suitable presets
  const transcodePromises = suitablePresets.map((preset) =>
    transcode(inputUrl, preset) // Pass inputUrl, not inputPathname
  );

  // Wait for all transcoding processes for suitable presets to complete
  const results = await Promise.all(transcodePromises);

  // Sort by resolution descending (optional, but good practice)
  return results.sort((a, b) => b.height - a.height);
};
