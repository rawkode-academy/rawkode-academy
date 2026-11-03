import assert from "node:assert/strict";
import test from "node:test";
import { hash, ServiceError, sessionSchema, type Broadcast, type Plan, type Session, type SessionState } from "../src/domain.ts";
import { GoogleClient, type PublishingAPI, type WritePrecondition } from "../src/google.ts";
import { Publisher, type PublishingStore } from "../src/publishing.ts";

const channelId = `UC${"a".repeat(22)}`;
const broadcastId = "AAAAAAAAAAA";
const now = Date.parse("2026-10-31T12:00:00Z");
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const clone = <T>(value: T): T => structuredClone(value);
const fails = (code: string) => (error: unknown) => error instanceof ServiceError && error.code === code;
const session = (extra: Partial<Session> = {}): Session => sessionSchema.parse({ sessionId: "academy-session-1", title: "A useful session", description: "Reviewed copy", scheduledStartTime: "2026-11-11T17:00:00Z", privacyStatus: "unlisted", madeForKids: false, ...extra });
const broadcast = (extra: Partial<Broadcast> = {}): Broadcast => ({
  id: broadcastId, etag: '"v1"',
  snippet: { channelId, title: "A useful session", description: "Original copy", scheduledStartTime: "2026-11-11T17:00:00.000Z", scheduledEndTime: "2026-11-11T18:00:00.000Z", categoryId: "28" },
  status: { lifeCycleStatus: "created", privacyStatus: "unlisted", selfDeclaredMadeForKids: false }, contentDetails: {}, ...extra,
});

class Store implements PublishingStore {
  sessions = new Map<string, SessionState>();
  plans = new Map<string, Plan>();
  getSession(id: string) { return clone(this.sessions.get(id) ?? { revision: 0 }); }
  putSession(id: string, state: SessionState) { this.sessions.set(id, clone(state)); }
  getPlan(id: string) { return clone(this.plans.get(id) ?? null); }
  putPlan(plan: Plan) { this.plans.set(plan.planId, clone(plan)); }
}

class FakeYouTube implements PublishingAPI {
  current: Broadcast | null = null;
  otherBroadcasts: Broadcast[] = [];
  writes: { method: string; resource: string; body: unknown; precondition?: WritePrecondition }[] = [];
  checkCount = 0;
  streamChecks = 0;
  thumbnailCalls = 0;
  thumbnailFailures = 0;
  createOutcome: "ok" | "lost_response" | "not_accepted" = "ok";
  beforeCreate?: () => void;
  beforeUpdate?: () => void;
  afterRead?: () => void;
  onStreamCheck?: () => void;
  async checkChannel() { this.checkCount++; }
  async broadcast(id: string) {
    if (!this.current || this.current.id !== id) throw new ServiceError("broadcast_not_found", "Missing broadcast", 404);
    const value = clone(this.current);
    this.afterRead?.();
    return value;
  }
  async broadcasts() { return clone([...(this.current ? [this.current] : []), ...this.otherBroadcasts]); }
  async checkStream(_id: string) { this.streamChecks++; this.onStreamCheck?.(); }
  async request<T>(method: string, resource: string, _query?: Record<string, string | number | boolean | undefined>, body?: unknown, precondition?: WritePrecondition): Promise<T> {
    this.writes.push({ method, resource, body: clone(body), precondition });
    if (method === "POST" && resource === "liveBroadcasts") {
      this.beforeCreate?.();
      if (this.createOutcome === "not_accepted") throw new Error("Connection interrupted before server response");
      const value = body as { snippet: Broadcast["snippet"]; status: Omit<Broadcast["status"], "lifeCycleStatus">; contentDetails: Broadcast["contentDetails"] };
      this.current = broadcast({ snippet: { ...value.snippet, channelId }, status: { ...value.status, lifeCycleStatus: "created" }, contentDetails: value.contentDetails });
      if (this.createOutcome === "lost_response") throw new Error("Server accepted request but response was lost");
      return clone(this.current) as T;
    }
    if (method === "PUT" && resource === "liveBroadcasts") {
      this.beforeUpdate?.();
      assert.equal(precondition?.ifMatch, this.current?.etag);
      this.current!.snippet = { ...(body as { snippet: Broadcast["snippet"] }).snippet, channelId };
      this.current!.etag = '"v2"';
    }
    if (resource === "liveBroadcasts/bind") this.current!.contentDetails = { boundStreamId: String(_query?.streamId) };
    return clone(this.current) as T;
  }
  async upload(_id: string, _bytes: Uint8Array, _contentType: string) {
    this.thumbnailCalls++;
    if (this.thumbnailFailures-- > 0) throw new Error("Transient upload failure");
  }
}
function fixture() {
  const store = new Store(); const api = new FakeYouTube();
  return { store, api, publisher: new Publisher(store, api, async () => png, channelId) };
}

test("planning makes no YouTube writes and explicitly disables automatic stream transitions", async () => {
  const { publisher, api } = fixture();
  const plan = await publisher.plan(session(), now);
  assert.equal(api.writes.length, 0);
  assert.equal(plan.actions[0].kind, "create");
  if (plan.actions[0].kind === "create") {
    assert.equal(plan.actions[0].body.contentDetails.enableAutoStart, false);
    assert.equal(plan.actions[0].body.contentDetails.enableAutoStop, false);
    assert.equal(plan.actions[0].body.status.privacyStatus, "unlisted");
  }
});

test("a create journals intent before POST, persists the returned ID, and applies once", async () => {
  const { publisher, api, store } = fixture();
  const desired = session();
  api.beforeCreate = () => {
    assert.equal(store.getSession(desired.sessionId).pendingCreate?.title, desired.title);
    assert.equal(store.getSession(desired.sessionId).revision, 1);
  };
  const plan = await publisher.plan(desired, now);
  const result = await publisher.apply(plan.planId, now);
  const replay = await publisher.apply(plan.planId, now + 60 * 60 * 1000);
  assert.deepEqual(replay, result);
  assert.equal(api.writes.length, 1);
  assert.equal(store.getSession(desired.sessionId).broadcastId, broadcastId);
  assert.equal(store.getSession(desired.sessionId).pendingCreate, undefined);
  assert.equal(result.url, `https://www.youtube.com/live/${broadcastId}`);
});

test("lost create response is reconciled to the existing broadcast, never duplicated", async () => {
  const { publisher, api, store } = fixture();
  api.createOutcome = "lost_response";
  const desired = session();
  const original = await publisher.plan(desired, now);
  await assert.rejects(publisher.apply(original.planId, now));
  assert.ok(store.getSession(desired.sessionId).pendingCreate);
  await assert.rejects(publisher.apply(original.planId, now), fails("replan_required"));
  const reconciled = await publisher.plan(desired, now);
  assert.equal(reconciled.broadcastId, broadcastId);
  assert.equal(reconciled.actions.some(a => a.kind === "create"), false);
  await publisher.apply(reconciled.planId, now);
  assert.equal(api.writes.length, 1);
  assert.equal(store.getSession(desired.sessionId).pendingCreate, undefined);
});

test("unknown creation with no match blocks new creation even if caller edits the manifest", async () => {
  const { publisher, api } = fixture();
  api.createOutcome = "not_accepted";
  const plan = await publisher.plan(session(), now);
  await assert.rejects(publisher.apply(plan.planId, now));
  await assert.rejects(publisher.plan(session({ title: "Try again" }), now), fails("creation_unknown"));
  assert.equal(api.writes.length, 1);
});

test("a definitive permission rejection permits a fresh plan after configuration is fixed, never an automatic retry", async () => {
  const store = new Store();
  let enabled = false; let creates = 0; let current: Broadcast | null = null;
  const api = new GoogleClient(JSON.stringify({ client_id: "client", client_secret: "secret", refresh_token: "refresh", channel_id: channelId }), channelId, (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === "oauth2.googleapis.com") return Response.json({ access_token: "access" });
    if (url.pathname.endsWith("/channels")) return Response.json({ items: [{ id: channelId }] });
    if (init?.method === "POST") {
      creates++;
      if (!enabled) return Response.json({ error: { code: 403, message: "Live streaming disabled", errors: [{ reason: "liveStreamingNotEnabled" }] } }, { status: 403 });
      const body = JSON.parse(String(init.body));
      current = broadcast({ snippet: { ...body.snippet, channelId }, status: { ...body.status, lifeCycleStatus: "created" } });
      return Response.json(current);
    }
    return Response.json({ items: current ? [current] : [] });
  }) as typeof fetch);
  const publisher = new Publisher(store, api, async () => png, channelId);
  const first = await publisher.plan(session(), now);
  await assert.rejects(publisher.apply(first.planId, now), fails("google_api_error"));
  assert.equal(creates, 1);
  assert.equal(store.getSession("academy-session-1").pendingCreate, undefined);
  assert.equal(store.getPlan(first.planId)?.status, "failed");
  enabled = true;
  await assert.rejects(publisher.apply(first.planId, now), fails("replan_required"));
  assert.equal(creates, 1);
  const corrected = await publisher.plan(session(), now);
  assert.equal(corrected.actions[0].kind, "create");
  await publisher.apply(corrected.planId, now);
  assert.equal(creates, 2);
  assert.equal(store.getSession("academy-session-1").broadcastId, broadcastId);
});

test("malformed rejection and server failure keep the creation intent", async () => {
  for (const response of [new Response("bad-json", { status: 403, headers: { "content-type": "application/json" } }), Response.json({ error: { code: 503, message: "Server failed", errors: [{ reason: "backendError" }] } }, { status: 503 }), new Response("bad-json", { status: 200, headers: { "content-type": "application/json" } })]) {
    const store = new Store();
    const api = new GoogleClient(JSON.stringify({ client_id: "client", client_secret: "secret", refresh_token: "refresh" }), channelId, (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.hostname === "oauth2.googleapis.com") return Response.json({ access_token: "access" });
      if (url.pathname.endsWith("/channels")) return Response.json({ items: [{ id: channelId }] });
      if (init?.method === "POST") return response;
      return Response.json({ items: [] });
    }) as typeof fetch);
    const publisher = new Publisher(store, api, async () => png, channelId);
    const plan = await publisher.plan(session(), now);
    await assert.rejects(publisher.apply(plan.planId, now));
    assert.ok(store.getSession("academy-session-1").pendingCreate);
    await assert.rejects(publisher.plan(session(), now), fails("creation_unknown"));
  }
});

test("a restarted Publisher reconciles an interrupted applying plan from durable intent", async () => {
  const { publisher, api, store } = fixture();
  const desired = session();
  const interrupted = await publisher.plan(desired, now);
  store.putPlan({ ...interrupted, status: "applying" });
  store.putSession(desired.sessionId, { revision: 1, pendingCreate: { title: desired.title!, scheduledStartTime: desired.scheduledStartTime!, attemptedAt: new Date(now).toISOString() } });
  api.current = broadcast({ snippet: { ...broadcast().snippet, description: desired.description } });
  const restarted = new Publisher(store, api, async () => png, channelId);
  await assert.rejects(restarted.apply(interrupted.planId, now), fails("replan_required"));
  const recovery = await restarted.plan(desired, now);
  const result = await restarted.apply(recovery.planId, now);
  assert.equal(result.broadcastId, broadcastId);
  assert.equal(api.writes.length, 0);
  assert.equal(store.getSession(desired.sessionId).pendingCreate, undefined);
});

test("a late conditional-update conflict cannot overwrite a newer Studio edit", async () => {
  const { publisher, api, store } = fixture();
  api.current = broadcast();
  const desired = session();
  const plan = await publisher.plan(desired, now);
  api.beforeUpdate = () => {
    api.current!.snippet.description = "Newer Studio copy";
    api.current!.etag = '"v2-external"';
    throw new ServiceError("stale_plan", "Precondition failed", 409);
  };
  await assert.rejects(publisher.apply(plan.planId, now), fails("stale_plan"));
  assert.equal(api.current.snippet.description, "Newer Studio copy");
  assert.equal(store.getPlan(plan.planId)?.status, "failed");
});

test("known ID disappearing never falls back to discovery or recreation", async () => {
  const { publisher, api, store } = fixture();
  store.putSession("academy-session-1", { revision: 1, broadcastId });
  await assert.rejects(publisher.plan(session(), now), fails("broadcast_not_found"));
  assert.equal(api.writes.length, 0);
});

test("multiple same-title same-time candidates require an explicit broadcast ID", async () => {
  const { publisher, api } = fixture();
  api.current = broadcast(); api.otherBroadcasts = [broadcast({ id: "BBBBBBBBBBB" })];
  await assert.rejects(publisher.plan(session(), now), fails("ambiguous_broadcast"));
  assert.equal(api.writes.length, 0);
});

test("partial thumbnail failure resumes the existing ID without another create", async () => {
  const { publisher, api, store } = fixture();
  api.thumbnailFailures = 1;
  const desired = session({ thumbnailSha256: await hash(png) });
  const first = await publisher.plan(desired, now);
  await assert.rejects(publisher.apply(first.planId, now));
  assert.equal(store.getSession(desired.sessionId).broadcastId, broadcastId);
  const second = await publisher.plan(desired, now);
  assert.deepEqual(second.actions.map(a => a.kind), ["thumbnail"]);
  await publisher.apply(second.planId, now);
  assert.equal(api.writes.length, 1);
  assert.equal(api.thumbnailCalls, 2);
});

test("title-only updates preserve description, category and times and send an If-Match precondition", async () => {
  const { publisher, api } = fixture();
  api.current = broadcast();
  const before = clone(api.current.snippet);
  const desired = sessionSchema.parse({ sessionId: "academy-session-1", broadcastId, title: "New title" });
  const plan = await publisher.plan(desired, now);
  await publisher.apply(plan.planId, now);
  assert.deepEqual(api.current.snippet, { ...before, title: "New title" });
  assert.deepEqual(api.writes[0].precondition, { ifMatch: '"v1"' });
});

test("read-back detects loss of a preserved field before later thumbnail writes", async () => {
  const { publisher, api } = fixture();
  api.current = broadcast();
  const read = api.broadcast.bind(api);
  api.broadcast = async id => {
    const value = await read(id);
    if (api.writes.length) value.snippet.description = "";
    return value;
  };
  const plan = await publisher.plan(sessionSchema.parse({ sessionId: "academy-session-1", broadcastId, title: "New title", thumbnailSha256: await hash(png) }), now);
  await assert.rejects(publisher.apply(plan.planId, now), fails("verification_failed"));
  assert.equal(api.thumbnailCalls, 0);
});

test("new broadcast ownership is checked before any thumbnail write", async () => {
  const { publisher, api, store } = fixture();
  const read = api.broadcast.bind(api);
  api.broadcast = async id => ({ ...await read(id), snippet: { ...api.current!.snippet, channelId: `UC${"b".repeat(22)}` } });
  const plan = await publisher.plan(session({ thumbnailSha256: await hash(png) }), now);
  await assert.rejects(publisher.apply(plan.planId, now), fails("channel_mismatch"));
  assert.equal(api.thumbnailCalls, 0);
  assert.equal(store.getSession("academy-session-1").broadcastId, broadcastId);
});

test("external changes after planning reject stale plans before writes", async () => {
  const { publisher, api } = fixture();
  api.current = broadcast();
  const plan = await publisher.plan(session(), now);
  api.current.snippet.description = "Someone edited Studio";
  await assert.rejects(publisher.apply(plan.planId, now), fails("stale_plan"));
  assert.equal(api.writes.length, 0);
});

test("a session revision changed during async validation cannot be overwritten", async () => {
  const { publisher, api, store } = fixture();
  const desired = session({ streamId: "encoder-1" });
  const plan = await publisher.plan(desired, now);
  api.onStreamCheck = () => store.putSession(desired.sessionId, { revision: 9 });
  await assert.rejects(publisher.apply(plan.planId, now), fails("stale_plan"));
  assert.equal(api.writes.length, 0);
  assert.equal(store.getSession(desired.sessionId).revision, 9);
});

test("expired plans cannot publish and prepared siblings become stale after one apply", async () => {
  const { publisher, api } = fixture();
  const expired = await publisher.plan(session(), now);
  await assert.rejects(publisher.apply(expired.planId, now + 15 * 60 * 1000), fails("plan_expired"));
  const first = await publisher.plan(session(), now);
  const sibling = await publisher.plan(session(), now);
  await publisher.apply(first.planId, now);
  await assert.rejects(publisher.apply(sibling.planId, now), fails("stale_plan"));
  assert.equal(api.writes.length, 1);
});

test("a plan expiring during asynchronous validation cannot publish", async context => {
  context.mock.timers.enable({ apis: ["Date"], now });
  const { publisher, api } = fixture();
  const plan = await publisher.plan(session({ streamId: "encoder-1" }), now);
  api.onStreamCheck = () => context.mock.timers.tick(16 * 60 * 1000);
  await assert.rejects(publisher.apply(plan.planId, now), fails("plan_expired"));
  assert.equal(api.writes.length, 0);
});

test("stream status is checked again immediately before binding", async () => {
  const { publisher, api, store } = fixture();
  const plan = await publisher.plan(session({ streamId: "encoder-1" }), now);
  api.onStreamCheck = () => { if (api.streamChecks >= 3) throw new ServiceError("invalid_stream", "The encoder became active", 409); };
  await assert.rejects(publisher.apply(plan.planId, now), fails("invalid_stream"));
  assert.equal(api.writes.length, 1);
  assert.equal(api.writes[0].resource, "liveBroadcasts");
  assert.equal(store.getSession("academy-session-1").broadcastId, broadcastId);
});

test("missing Google version refuses an unprotected update", async () => {
  const { publisher, api } = fixture();
  api.current = broadcast({ etag: undefined });
  const plan = await publisher.plan(session(), now);
  await assert.rejects(publisher.apply(plan.planId, now), fails("missing_precondition"));
  assert.equal(api.writes.length, 0);
});

test("thumbnail bytes must still match the content hash during apply", async () => {
  const store = new Store(); const api = new FakeYouTube();
  let bytes = png;
  const publisher = new Publisher(store, api, async () => bytes, channelId);
  const plan = await publisher.plan(session({ thumbnailSha256: await hash(png) }), now);
  bytes = new Uint8Array([...png, 1]);
  await assert.rejects(publisher.apply(plan.planId, now), fails("asset_mismatch"));
  assert.equal(api.writes.length, 0);
});

test("existing visibility/audience edits and active broadcasts fail closed", async () => {
  const { publisher, api } = fixture();
  api.current = broadcast();
  await assert.rejects(publisher.plan(session({ privacyStatus: "public" }), now), fails("visibility_change"));
  await assert.rejects(publisher.plan(session({ madeForKids: true }), now), fails("audience_change"));
  api.current.status.lifeCycleStatus = "live";
  await assert.rejects(publisher.plan(session(), now), fails("not_upcoming"));
  assert.equal(api.writes.length, 0);
});
