import { assertEquals } from "@std/assert";
import {
  buildTranscodeStatusDocument,
  getTranscodeStatusKey,
  serializeTranscodeError,
} from "./status.ts";

Deno.test("normalizes transcode status keys under output prefixes", () => {
  assertEquals(
    getTranscodeStatusKey("videos/rawkode-live/example"),
    "videos/rawkode-live/example/transcode-status.json",
  );
  assertEquals(
    getTranscodeStatusKey("videos/rawkode-live/example/"),
    "videos/rawkode-live/example/transcode-status.json",
  );
});

Deno.test("builds running status documents for Studio recordings", () => {
  assertEquals(
    buildTranscodeStatusDocument({
      status: "running",
      timestamp: "2026-06-06T12:00:00.000Z",
      videoId: "rawkode-live/example",
      studioSessionId: "rawkode-live-next",
      recordingId: "recording-1",
      sourceBucket: "rawkode-academy-content",
      sourceKey: "studio/recordings/rawkode-live-next/recording-1/source.webm",
      sourceEtag: "abc123",
      sourceFormat: "webm",
      outputPrefix: "videos/rawkode-live/example/",
    }),
    {
      status: "running",
      videoId: "rawkode-live/example",
      studioSessionId: "rawkode-live-next",
      recordingId: "recording-1",
      sourceBucket: "rawkode-academy-content",
      sourceKey: "studio/recordings/rawkode-live-next/recording-1/source.webm",
      sourceEtag: "abc123",
      sourceFormat: "webm",
      outputPrefix: "videos/rawkode-live/example/",
      startedAt: "2026-06-06T12:00:00.000Z",
    },
  );
});

Deno.test("builds complete status documents for VOD availability", () => {
  assertEquals(
    buildTranscodeStatusDocument({
      status: "complete",
      timestamp: "2026-06-06T13:00:00.000Z",
      videoId: "rawkode-live/example",
      sourceBucket: "rawkode-academy-content",
      sourceFormat: "mkv",
      outputPrefix: "videos/rawkode-live/example/",
    }),
    {
      status: "complete",
      videoId: "rawkode-live/example",
      studioSessionId: undefined,
      recordingId: undefined,
      sourceBucket: "rawkode-academy-content",
      sourceKey: undefined,
      sourceEtag: undefined,
      sourceFormat: "mkv",
      outputPrefix: "videos/rawkode-live/example/",
      completedAt: "2026-06-06T13:00:00.000Z",
    },
  );
});

Deno.test("builds failed status documents with serialized errors", () => {
  assertEquals(
    serializeTranscodeError(new Error("ffmpeg failed")),
    "ffmpeg failed",
  );
  assertEquals(serializeTranscodeError("plain failure"), "plain failure");

  assertEquals(
    buildTranscodeStatusDocument({
      status: "failed",
      timestamp: "2026-06-06T13:30:00.000Z",
      videoId: "rawkode-live/example",
      sourceBucket: "rawkode-academy-content",
      sourceFormat: "webm",
      outputPrefix: "videos/rawkode-live/example/",
      error: new Error("ffmpeg failed"),
    }).failedAt,
    "2026-06-06T13:30:00.000Z",
  );
});
