import { assertEquals, assertThrows } from "@std/assert";
import {
  DEFAULT_MAX_REVIEW_SOURCE_BYTES,
  isPrivateWorkFile,
  maxReviewSourceBytes,
  parseOutputMode,
  quoteEtag,
  reviewFfmpegArgs,
  reviewOutputKey,
  sameEtag,
  sha256Stream,
} from "./review.ts";

Deno.test("defaults to the unchanged HLS mode", () => {
  assertEquals(parseOutputMode(undefined), "hls");
  assertEquals(parseOutputMode(""), "hls");
  assertEquals(parseOutputMode("review-proxy"), "review-proxy");
  assertEquals(parseOutputMode("hls-approved"), "hls-approved");
  assertThrows(() => parseOutputMode("mp4"));
});

Deno.test("writes review proxies under an execution and attempt scoped key", () => {
  assertEquals(
    reviewOutputKey(
      "studio/recordings/session-1/recording-1/review/",
      "transcoding-job-x7k2p",
      "0",
    ),
    "studio/recordings/session-1/recording-1/review/transcoding-job-x7k2p-a0/review.mp4",
  );
  assertEquals(
    reviewOutputKey("studio/recordings/s/r/review", "exec/with spaces", "1"),
    "studio/recordings/s/r/review/exec-with-spaces-a1/review.mp4",
  );
});

Deno.test("pins ETags whether or not they are quoted", () => {
  assertEquals(quoteEtag("abc-2"), '"abc-2"');
  assertEquals(quoteEtag('"abc-2"'), '"abc-2"');
  assertEquals(sameEtag('"abc-2"', "abc-2"), true);
  assertEquals(sameEtag(undefined, "abc-2"), false);
  assertEquals(sameEtag('"other"', "abc-2"), false);
});

Deno.test("encodes a 720p H.264/AAC fast-start proxy", () => {
  const args = reviewFfmpegArgs("work/source.webm", "work/review.mp4");
  assertEquals(args.slice(args.indexOf("-vf"), args.indexOf("-vf") + 2), [
    "-vf",
    "scale=-2:'min(720,trunc(ih/2)*2)'",
  ]);
  assertEquals(args[args.indexOf("-c:v") + 1], "libx264");
  assertEquals(args[args.indexOf("-c:a") + 1], "aac");
  assertEquals(args[args.indexOf("-movflags") + 1], "+faststart");
  assertEquals(args.at(-1), "work/review.mp4");
});

Deno.test("bounds the review source size", () => {
  assertEquals(maxReviewSourceBytes(undefined), DEFAULT_MAX_REVIEW_SOURCE_BYTES);
  assertEquals(maxReviewSourceBytes("1024"), 1024);
  assertThrows(() => maxReviewSourceBytes("-1"));
  assertThrows(() => maxReviewSourceBytes("abc"));
});

Deno.test("never publishes the raw source or original.mkv for approved recordings", () => {
  assertEquals(isPrivateWorkFile("source.webm"), true);
  assertEquals(isPrivateWorkFile("original.mkv"), true);
  assertEquals(isPrivateWorkFile("original.mp3"), false);
  assertEquals(isPrivateWorkFile("stream.m3u8"), false);
});

Deno.test("hashes chunks as a stream", async () => {
  const encoder = new TextEncoder();
  assertEquals(
    await sha256Stream([encoder.encode('{"hello":'), encoder.encode('"world"}')]),
    "93a23971a914e5eacbf0a8d25154cda309c3c1c72fbb9914d47c60f3cb681588",
  );
});
