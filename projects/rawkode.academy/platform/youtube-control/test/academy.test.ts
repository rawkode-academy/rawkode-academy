import assert from "node:assert/strict";
import test from "node:test";
import { fetchVideos } from "../src/academy.ts";
import { ServiceError } from "../src/domain.ts";

const service = (body: unknown, status = 200) => ({ fetch: (async () => Response.json(body, { status })) as typeof fetch });
const channels = (rows: unknown) => service({ data: { videoChannels: rows } });
const titles = service({ data: { getAllVideos: [{ id: "a", title: "One" }, { id: "b", title: "Two" }] } });

test("the video list is every YouTube ID in video-channels, titled where the Academy has a video", async () => {
  const videos = await fetchVideos({ VIDEO_CHANNELS: channels([
    { videoId: "a", externalId: "abcdefghijk" },
    { videoId: "course-module-video", externalId: "bcdefghijkl" },
    { videoId: "c", externalId: "short" },
  ]), ACADEMY_API: titles });
  assert.deepEqual(videos, [{ videoId: "abcdefghijk", title: "One", publishedAt: null }, { videoId: "bcdefghijkl", title: "", publishedAt: null }]);
});

test("titles are best effort: a failing gateway does not stop collection", async () => {
  const videos = await fetchVideos({ VIDEO_CHANNELS: channels([{ videoId: "a", externalId: "abcdefghijk" }]), ACADEMY_API: service({}, 502) });
  assert.deepEqual(videos, [{ videoId: "abcdefghijk", title: "", publishedAt: null }]);
});

test("an error, an empty list or a failed request from video-channels fails the step", async () => {
  for (const response of [service({ errors: [{ message: "x" }] }), channels([]), service({}, 502)]) {
    await assert.rejects(fetchVideos({ VIDEO_CHANNELS: response, ACADEMY_API: titles }), (error: unknown) => error instanceof ServiceError && /academy/.test(error.code));
  }
});
