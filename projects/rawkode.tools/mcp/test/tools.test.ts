import { youtubeDailySql } from "../src/tools/analytics.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { grantedScopes, MODULE_SCOPES, modulesFor } from "../src/tools/index.ts";

test("consent grants the requested module scopes of the caller's role, or every read-only module of that role when none is named", () => {
  assert.deepEqual(MODULE_SCOPES, ["analytics:read", "guest:read", "video:write", "handles:write"]);
  assert.deepEqual(grantedScopes(["analytics:read", "offline_access"]), ["analytics:read"]);
  assert.deepEqual(grantedScopes([]), ["analytics:read"]);
  assert.deepEqual(grantedScopes(["offline_access"]), ["analytics:read"]);
  assert.deepEqual(grantedScopes(["analytics:read", "guest:read"], "operator"), ["analytics:read"]);
});

test("a guest is never granted the analytics module, whatever it asks for", () => {
  assert.deepEqual(grantedScopes(["analytics:read", "offline_access"], "guest"), ["guest:read"]);
  assert.deepEqual(grantedScopes([], "guest"), ["guest:read"]);
  assert.deepEqual(modulesFor(["analytics:read", "guest:read"], "guest").map(module => module.scope), ["guest:read"]);
  assert.deepEqual(modulesFor(["analytics:read", "guest:read"], "operator").map(module => module.scope), ["analytics:read"]);
});

test("a grant unlocks only its modules", () => {
  assert.deepEqual(modulesFor(["analytics:read"]).map(module => module.scope), ["analytics:read"]);
  assert.deepEqual(modulesFor(["offline_access"]), []);
});

test("youtube_daily reads likes, comments and shares as text, because json_get_int returns NULL for negative net values", () => {
  const sql = youtubeDailySql("2026-11-01", "2026-11-30");
  for (const field of ["likes", "comments", "shares"]) {
    assert.ok(sql.includes(`CAST(json_as_text(value, 'data', '${field}') AS BIGINT) AS ${field}`), field);
    assert.ok(!sql.includes(`json_get_int(value, 'data', '${field}')`), field);
  }
});

test("the video module is for operators, asked for by name, and calls the video-updates Worker as the signed-in operator", async () => {
  const { video } = await import("../src/tools/video.ts");
  assert.equal(video.audience, "operator");
  assert.equal(video.readOnly, false);
  assert.deepEqual(grantedScopes([]), ["analytics:read"], "asking for nothing never grants a module that changes data");
  assert.deepEqual(grantedScopes(["video:write"]), ["video:write"]);
  assert.deepEqual(modulesFor(["video:write"], "guest"), [], "a guest never reaches it");
  const calls: unknown[][] = [];
  const handlers = new Map<string, (input: any) => Promise<any>>();
  const rpc = { preview: async (r: unknown) => ({ sections: ["video"], errors: [], r }), update: async (...a: unknown[]) => { calls.push(a); return { updateId: "u1", sections: ["video"], duplicate: false }; }, status: async () => null, schedule: async (...a: unknown[]) => { calls.push(a); return { updateId: "u2", videoId: "newvid", sections: ["video"], duplicate: false }; } };
  video.register({ registerTool: (name: string, _config: unknown, handler: (input: any) => Promise<any>) => { handlers.set(name, handler); } } as any, { VIDEO_UPDATES: rpc, YOUTUBE_STREAMS: { get: async (videoId: string) => ({ videoId, broadcastId: "b1", ingestionAddress: "rtmp://a.example/live2", streamKey: "secret-key" }) } } as any, { userId: "u-1", username: "rawkode", role: "operator" });
  assert.deepEqual([...handlers.keys()].sort(), ["get_stream_key", "preview_video_update", "schedule_live_stream", "update_video", "video_update_status"]);
  const key = await handlers.get("get_stream_key")!({ videoId: "v1" });
  assert.deepEqual(JSON.parse(key.content[0].text), { videoId: "v1", broadcastId: "b1", ingestionAddress: "rtmp://a.example/live2", streamKey: "secret-key" });
  const updated = await handlers.get("update_video")!({ videoId: "v1", video: { title: "New" } });
  assert.equal(JSON.parse(updated.content[0].text).updateId, "u1");
  assert.deepEqual(calls[0], [{ videoId: "v1", video: { title: "New" } }, { userId: "u-1", username: "rawkode" }]);
  const scheduled = await handlers.get("schedule_live_stream")!({ privacy: "unlisted", video: { title: "Live" } });
  assert.equal(JSON.parse(scheduled.content[0].text).videoId, "newvid");
  assert.deepEqual(calls[1], [{ video: { title: "Live" }, broadcast: { privacy: "unlisted" } }, { userId: "u-1", username: "rawkode" }]);
  const missing = await handlers.get("video_update_status")!({ updateId: "nope" });
  assert.equal(JSON.parse(missing.content[0].text).error, "not_found");
});
