// OUTPUT_MODE selects what the job produces:
// - "hls" (default): the original public VOD path, unchanged.
// - "review-proxy": one private 720p H.264/AAC MP4 for Payload review, written
//   once under an execution-scoped key. No HLS and no public objects.
// - "hls-approved": public HLS for an approved Studio review recording. The raw
//   source and original.mkv stay in a private work directory and are never uploaded.
export type OutputMode = "hls" | "review-proxy" | "hls-approved";

export function parseOutputMode(value: string | undefined): OutputMode {
  if (value === undefined || value === "" || value === "hls") return "hls";
  if (value === "review-proxy" || value === "hls-approved") return value;
  throw new Error(`Unsupported OUTPUT_MODE ${value}`);
}

// Cloud Run's filesystem is memory-backed: the source and the proxy both count
// against the task memory limit (see README.md for the sizing).
export const DEFAULT_MAX_REVIEW_SOURCE_BYTES = 8 * 1024 * 1024 * 1024;
// A single PutObject is limited to 5 GiB.
export const MAX_REVIEW_OUTPUT_BYTES = 5 * 1024 * 1024 * 1024;

export function maxReviewSourceBytes(value: string | undefined): number {
  if (!value) return DEFAULT_MAX_REVIEW_SOURCE_BYTES;
  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes) || bytes < 1) {
    throw new Error("MAX_REVIEW_SOURCE_BYTES must be a positive integer");
  }
  return bytes;
}

// Execution and attempt scoped, so a duplicate execution or a task retry can
// never overwrite a review.mp4 that Payload has already pinned.
export function reviewOutputKey(
  outputPrefix: string,
  execution: string,
  attempt: string,
): string {
  const prefix = outputPrefix.endsWith("/") ? outputPrefix : `${outputPrefix}/`;
  const segment = `${execution}-a${attempt}`.replace(/[^A-Za-z0-9._-]/g, "-")
    .slice(0, 128);
  return `${prefix}${segment}/review.mp4`;
}

export function quoteEtag(etag: string): string {
  const bare = etag.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
  return `"${bare}"`;
}

export function sameEtag(left: string | undefined, right: string): boolean {
  return left !== undefined && quoteEtag(left) === quoteEtag(right);
}

export function reviewFfmpegArgs(input: string, output: string): string[] {
  return [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-i",
    input,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-vf",
    "scale=-2:'min(720,trunc(ih/2)*2)'",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-maxrate",
    "2500k",
    "-bufsize",
    "5000k",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    output,
  ];
}

// Only the approved HLS rendition and its derived audio become public.
export function isPrivateWorkFile(name: string): boolean {
  return /^source\.[a-z0-9]+$/.test(name) || name === "original.mkv";
}

export async function sha256Stream(
  chunks: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
): Promise<string> {
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256");
  for await (const chunk of chunks) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

export async function sha256File(path: string): Promise<string> {
  const { createReadStream } = await import("node:fs");
  return await sha256Stream(
    createReadStream(path) as unknown as AsyncIterable<Uint8Array>,
  );
}
