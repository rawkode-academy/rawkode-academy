import assert from "node:assert/strict";
import test from "node:test";
import { classify, renderReport } from "../src/plan.ts";
import { composeDescription, fieldHashes, type Snippet } from "../src/render.ts";

const academy = { id: "v1", title: "Cilium in depth", slug: "cilium-in-depth", collaborators: [] };
const live: Snippet = { title: "Cilium in depth", description: "Studio text", categoryId: "28" };
const fields = ["description"] as const;
const input = { youtubeId: "abcdefghijk", academy, live, base: undefined, fields };

test("a video the Academy does not list is skipped, as is one YouTube does not return", async () => {
  assert.equal((await classify({ ...input, academy: undefined })).status, "SKIP");
  assert.equal((await classify({ ...input, live: undefined })).status, "SKIP");
});

test("first sight adopts the live values as the baseline and plans the change", async () => {
  const item = await classify(input);
  assert.equal(item.status, "CHANGE");
  assert.deepEqual(item.adopt, await fieldHashes(live));
  assert.equal(item.diff[0].field, "description");
  assert.equal(item.desired?.description, composeDescription("Studio text", academy));
});

test("a live description that already matches is a no-op", async () => {
  const synced = { ...live, description: composeDescription("Studio text", academy) };
  assert.equal((await classify({ ...input, live: synced })).status, "NOOP");
});

test("unchanged since the baseline is a CHANGE, edited in Studio since is DRIFT", async () => {
  const base = await fieldHashes(live);
  assert.equal((await classify({ ...input, base })).status, "CHANGE");
  const edited = { ...live, description: "Someone edited this in Studio" };
  const drift = await classify({ ...input, base, live: edited });
  assert.equal(drift.status, "DRIFT");
  assert.match(drift.reason ?? "", /override/);
});

test("an unmanaged field edited in Studio is not drift", async () => {
  const base = await fieldHashes(live);
  assert.equal((await classify({ ...input, base, live: { ...live, title: "New title in Studio" } })).status, "CHANGE");
});

test("a title the site cannot send is an ERROR, never truncated", async () => {
  const item = await classify({ ...input, academy: { ...academy, title: "x".repeat(120) }, fields: ["title", "description"] });
  assert.equal(item.status, "ERROR");
  assert.equal(item.desired, null);
});

test("the report lists changes, drift and skips", async () => {
  const items = [await classify(input), await classify({ ...input, youtubeId: "bcdefghijkl", academy: undefined })];
  const report = renderReport({ id: "plan-1", createdAt: "2026-11-26T00:00:00Z", templateVersion: 1, fields: ["description"] }, items);
  assert.match(report, /\| CHANGE \| 1 \|/);
  assert.match(report, /## CHANGE \(1\)/);
  assert.match(report, /## SKIP \(1\)/);
});
