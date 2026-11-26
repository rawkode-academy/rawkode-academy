import assert from "node:assert/strict";
import test from "node:test";
import { classify, renderReport } from "../src/plan.ts";
import { composeDescription, fieldHashes, type AcademyVideo, type Field, type Snippet } from "../src/render.ts";

const academy: AcademyVideo = { id: "v1", title: "Cilium in depth", slug: "cilium-in-depth", collaborators: [], description: "About Cilium.", chapters: [], thumbnailUrl: "https://cdn.test/v1/thumbnail.webp", show: null, guests: [], technologies: [] };
const live: Snippet = { title: "Old title", description: "Studio text", categoryId: "28" };
const fields: Field[] = ["title", "description", "thumbnail"];
const input = { youtubeId: "abcdefghijk", academy, live, base: undefined, fields, thumbnailTag: "etag-2", pushedThumbnailTag: undefined };
const synced: Snippet = { ...live, title: academy.title, description: composeDescription(academy) };

test("a video the Academy does not list is skipped, as is one YouTube does not return", async () => {
  assert.equal((await classify({ ...input, academy: undefined })).status, "SKIP");
  assert.equal((await classify({ ...input, live: undefined })).status, "SKIP");
});

test("first sight adopts the live values as the baseline and plans every change", async () => {
  const item = await classify(input);
  assert.equal(item.status, "CHANGE");
  assert.deepEqual(item.adopt, await fieldHashes(live));
  assert.deepEqual(item.diff.map(d => d.field), ["description"]);
  assert.equal(item.desired?.title, "Old title");
  assert.deepEqual(item.thumbnail, { url: academy.thumbnailUrl, tag: "etag-2", changed: true });
});

test("the title is only written when the site has a show or course to suffix it with", async () => {
  const noContext = await classify(input);
  assert.equal(noContext.desired?.title, live.title);
  const show = await classify({ ...input, academy: { ...academy, show: { id: "s1", name: "Klustered" } } });
  assert.equal(show.desired?.title, "Cilium in depth | Klustered");
  assert.ok(show.diff.some(d => d.field === "title"));
});

test("text and thumbnail already in sync is a no-op", async () => {
  assert.equal((await classify({ ...input, live: synced, pushedThumbnailTag: "etag-2" })).status, "NOOP");
});

test("a new thumbnail alone is a change; an unreachable thumbnail source is ignored", async () => {
  const item = await classify({ ...input, live: synced, pushedThumbnailTag: "etag-1" });
  assert.equal(item.status, "CHANGE");
  assert.deepEqual(item.diff, []);
  assert.equal((await classify({ ...input, live: synced, thumbnailTag: null })).status, "NOOP");
});

test("there is no drift: a Studio edit is overwritten, and the reason says so", async () => {
  const base = await fieldHashes(synced);
  const edited = { ...synced, description: "Someone edited this in Studio" };
  const item = await classify({ ...input, base, live: edited, pushedThumbnailTag: "etag-2" });
  assert.equal(item.status, "CHANGE");
  assert.match(item.reason ?? "", /overwrites an edit made in Studio/);
  assert.equal(item.desired?.description, synced.description);
});

test("an unmanaged field is left alone", async () => {
  const item = await classify({ ...input, fields: ["description"], live: { ...synced, title: "Whatever" }, pushedThumbnailTag: "etag-2" });
  assert.equal(item.status, "NOOP");
  assert.equal(item.thumbnail, null);
});

test("an empty site title is an ERROR", async () => {
  const item = await classify({ ...input, academy: { ...academy, title: " " } });
  assert.equal(item.status, "ERROR");
  assert.equal(item.desired, null);
});

test("the report lists changes and skips", async () => {
  const items = [await classify(input), await classify({ ...input, youtubeId: "bcdefghijkl", academy: undefined })];
  const report = renderReport({ id: "plan-1", createdAt: "2026-11-26T00:00:00Z", templateVersion: 2, fields }, items);
  assert.match(report, /\| CHANGE \| 1 \|/);
  assert.match(report, /## CHANGE \(1\)/);
  assert.match(report, /\*\*thumbnail\*\* new: https:\/\/cdn\.test/);
  assert.match(report, /## SKIP \(1\)/);
});
