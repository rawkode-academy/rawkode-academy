import { actionsFor, ensure, fingerprint, hash, pickSnippet, ServiceError, thumbnailType, verify, type Broadcast, type Plan, type PublishResult, type Session, type SessionState } from "./domain.ts";
import { findBroadcast, type PublishingAPI } from "./google.ts";

export interface PublishingStore {
  getSession(id: string): SessionState;
  putSession(id: string, state: SessionState): void;
  getPlan(id: string): Plan | null;
  putPlan(plan: Plan): void;
}
export type LoadAsset = (sha: string) => Promise<Uint8Array>;

// The Durable Object serializes apply calls. This class keeps the state machine
// independent of Cloudflare so interrupted requests can be tested exhaustively.
export class Publisher {
  constructor(private store: PublishingStore, private api: PublishingAPI, private loadAsset: LoadAsset, private channelId: string) {}

  async plan(session: Session, now = Date.now()) {
    await this.api.checkChannel();
    const state = this.store.getSession(session.sessionId);
    const current = await findBroadcast(this.api, session, state);
    if (current) ensure(current.snippet.channelId === this.channelId, "wrong_channel", "Broadcast belongs to a different channel", 403);
    const actions = actionsFor(session, current, state, now);
    if (actions.some(a => a.kind === "bind")) await this.api.checkStream(session.streamId!);
    if (actions.some(a => a.kind === "thumbnail")) await this.asset(session.thumbnailSha256!);
    const plan: Plan = {
      planId: crypto.randomUUID(), session, revision: state.revision, fingerprint: await fingerprint(current), broadcastId: current?.id ?? null,
      actions, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 15 * 60 * 1000).toISOString(), status: "prepared",
    };
    this.store.putPlan(plan);
    return plan;
  }
  private async asset(sha: string) {
    const bytes = await this.loadAsset(sha);
    ensure(await hash(bytes) === sha, "asset_mismatch", "Stored thumbnail does not match the reviewed hash", 409);
    return { bytes, contentType: thumbnailType(bytes) };
  }
  async apply(planId: string, now = Date.now()): Promise<PublishResult> {
    const validationStartedAt = Date.now();
    const plan = this.store.getPlan(planId);
    ensure(plan, "plan_not_found", "Plan was not found", 404);
    // Ownership is checked even for replayed results so revoked/rebound credentials
    // cannot silently return a successful publish under the wrong identity.
    await this.api.checkChannel();
    if (plan.status === "applied" && plan.result) return plan.result;
    ensure(plan.status === "prepared", "replan_required", "This plan has already been attempted. Prepare a new plan to reconcile its outcome", 409);
    ensure(Date.parse(plan.expiresAt) > now, "plan_expired", "Plan expired; prepare a new plan", 409);
    const session = plan.session;
    let state = this.store.getSession(session.sessionId);
    ensure(state.revision === plan.revision, "stale_plan", "Session changed after planning; prepare a new plan", 409);
    let current = await findBroadcast(this.api, session, state);
    if (current) ensure(current.snippet.channelId === this.channelId, "wrong_channel", "Broadcast belongs to a different channel", 403);
    ensure(await fingerprint(current) === plan.fingerprint, "stale_plan", "YouTube changed after planning; prepare a new plan", 409);
    const expected = {
      ...session,
      ...(current ? { ...pickSnippet(current.snippet), privacyStatus: current.status.privacyStatus, ...(current.status.selfDeclaredMadeForKids === undefined ? {} : { madeForKids: current.status.selfDeclaredMadeForKids }) } : {}),
      ...session,
    };
    const actions = actionsFor(session, current, state, now);
    ensure(JSON.stringify(actions) === JSON.stringify(plan.actions), "stale_plan", "Planned actions changed; prepare a new plan", 409);
    if (actions.some(a => a.kind === "bind")) await this.api.checkStream(session.streamId!);
    const thumbnail = actions.some(a => a.kind === "thumbnail") ? await this.asset(session.thumbnailSha256!) : null;
    if (actions.some(a => a.kind === "update")) ensure(current?.etag, "missing_precondition", "Google returned no version for the broadcast; refusing an update without a version precondition", 502);
    const validatedAt = now + Math.max(0, Date.now() - validationStartedAt);
    ensure(Date.parse(plan.expiresAt) > validatedAt, "plan_expired", "Plan expired during validation; prepare a new plan", 409);
    // Network and asset validation can outlast a near-term start or plan expiry.
    actionsFor(session, current, state, validatedAt);
    // The DO's apply guard is the primary lock; checking again after async reads
    // also prevents a changed session or attempted plan from being reclaimed.
    ensure(this.store.getSession(session.sessionId).revision === plan.revision && this.store.getPlan(planId)?.status === "prepared", "stale_plan", "Session changed during validation; prepare a new plan", 409);
    // No await between claim and persisted session revision. A crash afterwards
    // leaves an attempted plan, which must be reconciled rather than replayed.
    plan.status = "applying";
    this.store.putPlan(plan);
    state = { ...state, revision: state.revision + 1 };
    if (current) { state.broadcastId = current.id; delete state.pendingCreate; }
    this.store.putSession(session.sessionId, state);
    try {
      for (const action of actions) {
        if (action.kind === "create") {
          state.pendingCreate = { title: session.title!, scheduledStartTime: session.scheduledStartTime!, attemptedAt: new Date(now).toISOString() };
          this.store.putSession(session.sessionId, state); // BEFORE the non-idempotent POST.
          try {
            current = await this.api.request<Broadcast>("POST", "liveBroadcasts", { part: "snippet,status,contentDetails" }, action.body);
          } catch (error) {
            // Only a validated Google rejection proves no broadcast was created.
            // Keep the attempted plan failed and require a fresh reviewed plan.
            if (error instanceof ServiceError && error.code === "google_api_error" && error.definitiveRejection && [400, 401, 403, 404].includes(error.upstreamStatus ?? 0)) {
              delete state.pendingCreate;
              this.store.putSession(session.sessionId, state);
            }
            throw error;
          }
          ensure(/^[A-Za-z0-9_-]{11}$/.test(current.id ?? ""), "creation_unknown", "Creation returned no valid ID; reconcile before continuing", 502);
          state.broadcastId = current.id;
          delete state.pendingCreate;
          this.store.putSession(session.sessionId, state); // BEFORE thumbnail/binding.
          // Verify ownership and created metadata before any follow-up write.
          current = await this.api.broadcast(state.broadcastId);
          verify({ ...expected, streamId: undefined }, current, this.channelId);
        } else if (action.kind === "update") {
          // YouTube's Data API overview documents conditional updates with ETags.
          // The liveBroadcasts.update page does not restate header behavior; live
          // acceptance must verify it. Reads/fingerprints remain useful checks,
          // but cannot guarantee atomicity with concurrent YouTube Studio edits.
          await this.api.request("PUT", "liveBroadcasts", { part: "snippet" }, action.body, { ifMatch: current!.etag });
          current = await this.api.broadcast(state.broadcastId!);
          verify({ ...expected, streamId: undefined }, current, this.channelId);
        } else if (action.kind === "thumbnail") {
          current = await this.api.broadcast(state.broadcastId!);
          ensure(["created", "ready"].includes(current.status.lifeCycleStatus), "not_upcoming", "Broadcast is no longer upcoming; prepare a new plan", 409);
          verify({ ...expected, streamId: undefined }, current, this.channelId);
          await this.api.upload(state.broadcastId!, thumbnail!.bytes, thumbnail!.contentType);
          state.thumbnailSha256 = action.sha256;
          this.store.putSession(session.sessionId, state);
        } else {
          current = await this.api.broadcast(state.broadcastId!);
          ensure(["created", "ready"].includes(current.status.lifeCycleStatus), "not_upcoming", "Broadcast is no longer upcoming; prepare a new plan", 409);
          verify({ ...expected, streamId: undefined }, current, this.channelId);
          await this.api.checkStream(action.streamId);
          await this.api.request("POST", "liveBroadcasts/bind", { id: state.broadcastId!, streamId: action.streamId, part: "id,contentDetails" });
        }
      }
      current = await this.api.broadcast(state.broadcastId!);
      verify(expected, current, this.channelId);
      const result: PublishResult = {
        broadcastId: current.id, channelId: this.channelId, title: current.snippet.title, scheduledStartTime: current.snippet.scheduledStartTime,
        privacyStatus: current.status.privacyStatus, lifeCycleStatus: current.status.lifeCycleStatus, url: `https://www.youtube.com/live/${current.id}`,
        changed: actions.map(a => a.kind), verifiedAt: new Date().toISOString(), thumbnail: thumbnail ? "Upload acknowledged; visually verify in YouTube" : "Unchanged",
      };
      plan.status = "applied"; plan.result = result;
      this.store.putPlan(plan);
      return result;
    } catch (error) {
      plan.status = "failed";
      this.store.putPlan(plan);
      throw error;
    }
  }
}
