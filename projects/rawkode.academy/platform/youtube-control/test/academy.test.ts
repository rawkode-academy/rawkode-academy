import assert from "node:assert/strict";
import test from "node:test";
import { fetchVideos } from "../src/academy.ts";
import { ServiceError } from "../src/domain.ts";

const gateway = (body: unknown, status = 200) => ({ fetch: (async () => Response.json(body, { status })) as typeof fetch });

test("the video list is the Academy's YouTube IDs, ignoring other platforms and malformed IDs", async () => {
  const videos = await fetchVideos(gateway({ data: { getAllVideos: [
    { id: "a", title: "One", channels: [{ platform: "X", externalId: "123" }, { platform: "YOUTUBE", externalId: "abcdefghijk" }] },
    { id: "b", title: "Two", channels: [{ platform: "YOUTUBE", externalId: "bcdefghijkl" }] },
    { id: "c", title: "Bad", channels: [{ platform: "YOUTUBE", externalId: "short" }] },
    { id: "d", title: "None", channels: [] },
  ] } }));
  assert.deepEqual(videos, [{ videoId: "abcdefghijk", title: "One", publishedAt: null }, { videoId: "bcdefghijkl", title: "Two", publishedAt: null }]);
});

test("an error, an empty list or a failed request fails the step instead of dropping every video", async () => {
  for (const response of [gateway({ errors: [{ message: "x" }] }), gateway({ data: { getAllVideos: [{ id: "a", title: "A", channels: [] }] } }), gateway({}, 502)]) {
    await assert.rejects(fetchVideos(response), (error: unknown) => error instanceof ServiceError && /academy/.test(error.code));
  }
});
