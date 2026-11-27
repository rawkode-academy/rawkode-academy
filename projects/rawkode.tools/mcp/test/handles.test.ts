import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { grantedScopes, modulesFor } from "../src/tools/index.ts";
import { personInput, recentHandleWrites, setPersonHandles, setTechnologyHandles, technologyInput } from "../src/tools/handles.ts";

// A D1-shaped wrapper over in-memory SQLite.
function d1(db: DatabaseSync) {
  return { prepare: (sql: string) => { const stmt = db.prepare(sql); return { bind: (...args: any[]) => ({
    first: async () => stmt.get(...args) ?? null,
    run: async () => ({ meta: { changes: Number(stmt.run(...args).changes) } }),
  }) }; } };
}
function setup() {
  const people = new DatabaseSync(":memory:");
  people.exec("CREATE TABLE people (id TEXT PRIMARY KEY, twitter TEXT, bluesky TEXT, linkedin TEXT, mastodon TEXT, updated_at INTEGER)");
  people.exec("INSERT INTO people (id, twitter) VALUES ('omar-polo', NULL), ('ellie', 'ellie_huxtable')");
  const techs = new DatabaseSync(":memory:");
  techs.exec("CREATE TABLE technologies (id TEXT PRIMARY KEY, community TEXT, updated_at INTEGER)");
  techs.exec(`INSERT INTO technologies (id, community) VALUES ('plakar', NULL), ('atuin', '{"twitter":"https://twitter.com/atuinsh"}')`);
  const kv = new Map<string, string>();
  const env = { PEOPLE: d1(people), TECHNOLOGIES: d1(techs), OAUTH_KV: {
    put: async (k: string, v: string) => { kv.set(k, v); },
    get: async (k: string) => kv.get(k) ?? null,
    list: async ({ prefix }: { prefix: string }) => ({ keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }),
  } } as any;
  return { env, people, techs, kv };
}
const actor = { userId: "u-1", username: "rawkode" };

test("the handles module is operator-only and must be asked for by name", () => {
  assert.deepEqual(grantedScopes([]), ["analytics:read"]);
  assert.deepEqual(grantedScopes(["handles:write"]), ["handles:write"]);
  assert.deepEqual(modulesFor(["handles:write"], "guest"), []);
});

test("a person's empty handles are filled, set ones are never overwritten, and the write is audited with its source", async () => {
  const { env, people } = setup();
  const input = personInput.parse({ personId: "ellie", handles: { twitter: "someoneelse", bluesky: "ellie.wtf" }, sourceUrl: "https://github.com/ellie" });
  const result = await setPersonHandles(env, input, actor);
  assert.deepEqual(result.applied, { bluesky: "ellie.wtf" });
  assert.match(result.skipped.twitter!, /already set/);
  assert.equal((people.prepare("SELECT twitter, bluesky FROM people WHERE id='ellie'").get() as any).twitter, "ellie_huxtable");
  const [entry] = await recentHandleWrites(env, 5);
  assert.equal(entry.sourceUrl, "https://github.com/ellie");
  assert.deepEqual(entry.actor, actor);
  await assert.rejects(setPersonHandles(env, personInput.parse({ personId: "nobody", handles: { twitter: "x" }, sourceUrl: "https://example.com" }), actor), /no person/);
});

test("a technology's community JSON gains only missing keys", async () => {
  const { env, techs } = setup();
  const plakar = await setTechnologyHandles(env, technologyInput.parse({ technologyId: "plakar", handles: { twitter: "https://x.com/PlakarKorp", bluesky: "https://bsky.app/profile/plakar.bsky.social" }, sourceUrl: "https://www.plakar.io" }), actor);
  assert.deepEqual(plakar.applied, { twitter: "https://x.com/PlakarKorp", bluesky: "https://bsky.app/profile/plakar.bsky.social" });
  const atuin = await setTechnologyHandles(env, technologyInput.parse({ technologyId: "atuin", handles: { twitter: "https://x.com/other", mastodon: "https://hachyderm.io/@atuin" }, sourceUrl: "https://atuin.sh" }), actor);
  assert.deepEqual(atuin.applied, { mastodon: "https://hachyderm.io/@atuin" });
  assert.equal(JSON.parse((techs.prepare("SELECT community FROM technologies WHERE id='atuin'").get() as any).community).twitter, "https://twitter.com/atuinsh");
});

test("input is validated: a source is required, handles are the right shape, nothing else can be named", () => {
  assert.throws(() => personInput.parse({ personId: "ellie", handles: { twitter: "ok" } }));
  assert.throws(() => personInput.parse({ personId: "ellie", handles: { twitter: "@ellie" }, sourceUrl: "https://x.com" }));
  assert.throws(() => personInput.parse({ personId: "ellie", handles: {}, sourceUrl: "https://x.com" }));
  assert.throws(() => personInput.parse({ personId: "ellie", handles: { twitter: "ok" }, sourceUrl: "http://x.com" }));
  assert.throws(() => personInput.parse({ personId: "ellie", name: "Renamed", handles: { twitter: "ok" }, sourceUrl: "https://x.com" }));
  assert.throws(() => technologyInput.parse({ technologyId: "plakar", handles: { website: "https://x.com" }, sourceUrl: "https://x.com" }));
});

test("the handles module tells the model to record and tag handles and to keep tooling notes out of posts", async () => {
  const { handles } = await import("../src/tools/handles.ts");
  assert.match(handles.instructions!, /set_person_handles/);
  assert.match(handles.instructions!, /Never put tooling notes/);
});
