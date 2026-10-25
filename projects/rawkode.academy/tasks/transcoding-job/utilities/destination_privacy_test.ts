import { assertEquals, assertRejects } from "@std/assert";
import type { S3Client } from "@aws-sdk/client-s3";
import { deletePrivateDestinationObjects } from "./s3.ts";

type Sent = { prefix?: string; key?: string; token?: string };

function fakeS3(pages: Array<{ keys: string[]; truncated?: boolean }>) {
  const sent: Sent[] = [];
  let page = 0;
  const client = {
    async send(command: { input?: { Prefix?: string; Key?: string; ContinuationToken?: string } }) {
      const input = command.input ?? {};
      if (input.Prefix) {
        sent.push({ prefix: input.Prefix, token: input.ContinuationToken });
        const current = pages[page] ?? { keys: [] };
        page += 1;
        return {
          Contents: current.keys.map((Key) => ({ Key })),
          IsTruncated: current.truncated === true,
          NextContinuationToken: current.truncated ? "next" : undefined,
        };
      }
      if (input.Key) {
        sent.push({ key: input.Key });
        return {};
      }
      throw new Error("unexpected s3 command");
    },
  };
  return { client: client as unknown as S3Client, sent };
}

Deno.test("approved promotion deletes only leftover raw destination objects", async () => {
  const { client, sent } = fakeS3([
    {
      keys: ["videos/video-1/stream.m3u8"],
      truncated: true,
    },
    {
      keys: [
        "videos/video-1/source.webm",
        "videos/video-1/original.mkv",
        "videos/video-1/original.mp3",
        "videos/video-1/720p/original.mkv",
      ],
    },
  ]);
  const deleted = await deletePrivateDestinationObjects(client, "bucket", "videos/video-1/");
  assertEquals(deleted, [
    "videos/video-1/source.webm",
    "videos/video-1/original.mkv",
  ]);
  assertEquals(
    sent.filter((entry) => entry.key).map((entry) => entry.key),
    deleted,
  );
  assertEquals(sent.filter((entry) => entry.prefix).map((entry) => entry.token), [
    undefined,
    "next",
  ]);
});

Deno.test("refuses to list a prefix that is not an approved video", async () => {
  const { client, sent } = fakeS3([]);
  await assertRejects(
    () => deletePrivateDestinationObjects(client, "bucket", "studio/recordings/session/"),
    Error,
    "Refusing to delete",
  );
  assertEquals(sent, []);
});
