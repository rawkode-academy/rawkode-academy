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
