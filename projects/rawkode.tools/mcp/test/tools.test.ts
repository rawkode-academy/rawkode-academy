import { youtubeDailySql } from "../src/tools/analytics.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { grantedScopes, MODULE_SCOPES, modulesFor } from "../src/tools/index.ts";

test("consent grants the requested module scopes, or every read-only module when none is named", () => {
  assert.deepEqual(MODULE_SCOPES, ["analytics:read"]);
  assert.deepEqual(grantedScopes(["analytics:read", "offline_access"]), ["analytics:read"]);
  assert.deepEqual(grantedScopes([]), ["analytics:read"]);
  assert.deepEqual(grantedScopes(["offline_access"]), ["analytics:read"]);
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
