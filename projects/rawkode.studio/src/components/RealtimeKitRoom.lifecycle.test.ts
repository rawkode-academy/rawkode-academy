import { createRenderer, h, nextTick, ssrContextKey } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialStudioState } from "../studio/seed";
import { reduceStudioState } from "../studio/studioMachine";
import type { StudioSource } from "../types";

const mocks = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock("@cloudflare/realtimekit", () => ({ default: { init: mocks.init } }));
vi.mock("@cloudflare/realtimekit-ui/loader", () => ({ defineCustomElements: vi.fn() }));
vi.mock("./ContributorLocalRecording.vue", () => ({ default: { render: () => null } }));

import RealtimeKitRoom from "./RealtimeKitRoom.vue";

type Listener = (...args: any[]) => void;
class Emitter {
  listeners = new Map<string, Set<Listener>>();
  on(event: string, listener: Listener) {
    const listeners = this.listeners.get(event) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(event, listeners);
  }
  off(event: string, listener: Listener) { this.listeners.get(event)?.delete(listener); }
  emit(event: string, ...args: any[]) {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }
}

class ParticipantMap extends Map<string, unknown> {
  events = new Emitter();
  on(event: string, listener: Listener) { this.events.on(event, listener); }
  off(event: string, listener: Listener) { this.events.off(event, listener); }
  emit(event: string, ...args: any[]) { this.events.emit(event, ...args); }
}

type Node = { type: string; children: Node[]; props: Record<string, unknown>; parent?: Node; text?: string };
const node = (type: string): Node => ({ type, children: [], props: {} });
const renderer = createRenderer<Node, Node>({
  createElement: node,
  createText: (text) => ({ ...node("#text"), text }),
  createComment: (text) => ({ ...node("#comment"), text }),
  setText: (target, text) => { target.text = text; },
  setElementText: (target, text) => { target.text = text; target.children = []; },
  patchProp: (target, key, _old, value) => { target.props[key] = value; },
  insert: (child, parent, anchor) => {
    child.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, child);
  },
  remove: (child) => {
    const siblings = child.parent?.children;
    if (siblings) siblings.splice(siblings.indexOf(child), 1);
    child.parent = undefined;
  },
  parentNode: (child) => child.parent ?? null,
  nextSibling: (child) => child.parent?.children[child.parent.children.indexOf(child) + 1] ?? null,
});

type MediaPayload = {
  authoritative: boolean;
  departedSourceIds?: string[];
  sources: StudioSource[];
  streams: Map<string, MediaStream>;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function flush() {
  for (let i = 0; i < 50; i += 1) await Promise.resolve();
  await nextTick();
}

function mount(onMedia: (payload: MediaPayload) => void) {
  const root = node("root");
  const component = {
    ...RealtimeKitRoom,
    render(this: { $: { setupState: Record<string, unknown> } }) {
      return h("button", { onClick: this.$.setupState.toggleRoom });
    },
  };
  const app = renderer.createApp(component, {
    sessionId: "session", role: "producer", providerReady: true, onMediaStreamsChange: onMedia,
  });
  app.provide(ssrContextKey, { modules: new Set() });
  app.mount(root);
  return { app, click: () => (root.children[0].props.onClick as () => void)() };
}

let windowEvents: Emitter;

beforeEach(() => {
  mocks.init.mockReset();
  windowEvents = new Emitter();
  vi.stubGlobal("window", {
    customElements: { get: () => true },
    addEventListener: (event: string, listener: Listener) => windowEvents.on(event, listener),
    removeEventListener: (event: string, listener: Listener) => windowEvents.off(event, listener),
  });
  vi.stubGlobal("MediaStream", class { constructor(readonly tracks: unknown[]) {} });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ token: "token" }))));
});

afterEach(() => vi.unstubAllGlobals());

function fakeMeeting(leave = vi.fn(async () => {})) {
  const self = Object.assign(new Emitter(), {
    roomJoined: true, audioEnabled: false, videoEnabled: false,
    customParticipantId: "local", userId: "local-user", id: "local-peer",
  });
  const meta = Object.assign(new Emitter(), { socketState: { state: "connected" } });
  const joined = new ParticipantMap();
  const active = new ParticipantMap();
  const peer = {
    id: "peer-one", userId: "user-one", name: "Guest", customParticipantId: "studio:guest:user-one",
    audioEnabled: true, audioTrack: { kind: "audio", readyState: "live" },
  };
  joined.set(peer.id, peer);
  active.set(peer.id, peer);
  return { self, meta, participants: { joined, active }, peer, leave };
}

describe("RealtimeKit room authority lifecycle", () => {
  it("publishes remote media and revokes it immediately when close hangs", async () => {
    const leaving = deferred<void>();
    const meeting = fakeMeeting(vi.fn(() => leaving.promise));
    mocks.init.mockResolvedValue(meeting);
    const events: MediaPayload[] = [];
    const room = mount((event) => events.push(event));
    room.click();
    await flush();
    expect(mocks.init).toHaveBeenCalledOnce();
    expect(events.at(-1)?.authoritative).toBe(true);
    const source = events.at(-1)?.sources[0];
    expect(source?.name).toBe("Guest");
    expect(events.at(-1)?.streams.has(source!.id)).toBe(true);

    room.click();
    await flush();
    expect(meeting.leave).toHaveBeenCalledOnce();
    expect(events.at(-1)).toMatchObject({ authoritative: false, sources: [], departedSourceIds: [source!.id] });
    expect(events.at(-1)?.streams.size).toBe(0);
    leaving.resolve();
    await flush();
    room.app.unmount();
  });

  it("revokes on a socket interruption and requires fresh admission after rejoin", async () => {
    const meeting = fakeMeeting();
    mocks.init.mockResolvedValue(meeting);
    const events: MediaPayload[] = [];
    const room = mount((event) => events.push(event));
    room.click();
    await flush();
    const first = events.at(-1)!;
    const source = first.sources[0];
    let state = reduceStudioState(createInitialStudioState(), { type: "sources.reconcile", sources: first.sources });
    state = reduceStudioState(state, { type: "source.admission.set", sourceId: source.id, admitted: true });

    meeting.meta.emit("socketConnectionUpdate", { state: "reconnecting" });
    const lost = events.at(-1)!;
    expect(lost).toMatchObject({ authoritative: false, sources: [], departedSourceIds: [source.id] });
    state = reduceStudioState(state, {
      type: "sources.reconcile", sources: lost.sources, departedSourceIds: lost.departedSourceIds,
    });
    meeting.self.emit("roomJoined");
    expect(events.at(-1)?.authoritative).toBe(false);
    meeting.meta.emit("socketConnectionUpdate", { state: "connected" });
    meeting.participants.active.emit("participantsUpdate");
    expect(events.at(-1)?.authoritative).toBe(false);
    expect(events.at(-1)?.streams.size).toBe(0);

    meeting.self.emit("roomJoined");
    const rejoined = events.at(-1)!;
    expect(rejoined.authoritative).toBe(true);
    expect(rejoined.sources[0].id).toBe(source.id);
    state = reduceStudioState(state, { type: "sources.reconcile", sources: rejoined.sources });
    expect(state.onStageSourceIds).not.toContain(source.id);
    room.app.unmount();
  });

  it("revokes once on browser offline and does not restore authority on stale room events", async () => {
    const meeting = fakeMeeting();
    mocks.init.mockResolvedValue(meeting);
    const events: MediaPayload[] = [];
    const room = mount((event) => events.push(event));
    room.click();
    await flush();
    const sourceId = events.at(-1)!.sources[0].id;

    windowEvents.emit("offline");
    expect(events.at(-1)?.departedSourceIds).toEqual([sourceId]);
    meeting.self.emit("roomJoined");
    expect(events.at(-1)?.authoritative).toBe(false);
    windowEvents.emit("offline");
    expect(events.at(-1)?.departedSourceIds).toEqual([]);
    meeting.self.emit("roomLeft");
    meeting.participants.joined.emit("participantLeft", meeting.peer);
    expect(events.at(-1)?.authoritative).toBe(false);
    expect(events.at(-1)?.streams.size).toBe(0);
    windowEvents.emit("online");
    meeting.self.emit("roomJoined");
    expect(events.at(-1)?.authoritative).toBe(false);
    meeting.meta.emit("socketConnectionUpdate", { state: "connected" });
    meeting.self.emit("roomJoined");
    expect(events.at(-1)?.authoritative).toBe(true);
    room.app.unmount();
  });

  it("does not trust a joined snapshot while the initial socket is reconnecting", async () => {
    const meeting = fakeMeeting();
    meeting.meta.socketState.state = "reconnecting";
    mocks.init.mockResolvedValue(meeting);
    const events: MediaPayload[] = [];
    const room = mount((event) => events.push(event));
    room.click();
    await flush();
    expect(events.at(-1)).toMatchObject({ authoritative: false, sources: [] });
    meeting.self.emit("roomJoined");
    expect(events.at(-1)?.authoritative).toBe(false);
    meeting.meta.emit("socketConnectionUpdate", { state: "connected" });
    meeting.self.emit("roomJoined");
    expect(events.at(-1)?.authoritative).toBe(true);
    room.app.unmount();
  });

  it("retains admission when a peer leaves the active subscription map but not the room", async () => {
    const meeting = fakeMeeting();
    mocks.init.mockResolvedValue(meeting);
    const events: MediaPayload[] = [];
    const room = mount((event) => events.push(event));
    room.click();
    await flush();
    const camera = events.at(-1)!.sources[0];

    meeting.participants.active.delete(meeting.peer.id);
    meeting.participants.active.emit("participantLeft", meeting.peer);
    expect(events.at(-1)?.authoritative).toBe(true);
    expect(events.at(-1)?.sources.map((source) => source.id)).toContain(camera.id);
    expect(events.at(-1)?.departedSourceIds).toEqual([]);

    meeting.participants.joined.delete(meeting.peer.id);
    meeting.participants.joined.emit("participantLeft", meeting.peer);
    expect(events.at(-1)?.departedSourceIds).toContain(camera.id);
    room.app.unmount();
  });

  it("fails authority closed if a room departure cannot be identified", async () => {
    const meeting = fakeMeeting();
    mocks.init.mockResolvedValue(meeting);
    const events: MediaPayload[] = [];
    const room = mount((event) => events.push(event));
    room.click();
    await flush();
    const sourceId = events.at(-1)!.sources[0].id;
    meeting.participants.joined.emit("participantLeft", { name: "Guest" });
    expect(events.at(-1)).toMatchObject({ authoritative: false, sources: [], departedSourceIds: [sourceId] });
    room.app.unmount();
  });

  it("revokes on joined-map clear but not when only subscriptions are cleared", async () => {
    const meeting = fakeMeeting();
    mocks.init.mockResolvedValue(meeting);
    const events: MediaPayload[] = [];
    const room = mount((event) => events.push(event));
    room.click();
    await flush();
    const sourceId = events.at(-1)!.sources[0].id;

    meeting.participants.active.clear();
    meeting.participants.active.emit("participantsCleared");
    expect(events.at(-1)?.authoritative).toBe(true);
    expect(events.at(-1)?.departedSourceIds).toEqual([]);
    expect(events.at(-1)?.sources.map((source) => source.id)).toContain(sourceId);

    meeting.participants.joined.clear();
    meeting.participants.joined.emit("participantsCleared");
    expect(events.at(-1)).toMatchObject({ authoritative: false, sources: [], departedSourceIds: [sourceId] });
    room.app.unmount();
  });

  it("revokes a stopped screen even if participant snapshots still contain the old share", async () => {
    const meeting = fakeMeeting();
    const sharing = Object.assign(meeting.peer, {
      screenShareEnabled: true,
      screenShareTracks: { video: { kind: "video", readyState: "live" } },
    });
    mocks.init.mockResolvedValue(meeting);
    const events: MediaPayload[] = [];
    const room = mount((event) => events.push(event));
    room.click();
    await flush();
    const initial = events.at(-1)!;
    const camera = initial.sources.find((source) => source.type === "camera")!;
    const screen = initial.sources.find((source) => source.type === "screen")!;
    let state = reduceStudioState(createInitialStudioState(), { type: "sources.reconcile", sources: initial.sources });
    state = reduceStudioState(state, { type: "source.admission.set", sourceId: camera.id, admitted: true });
    state = reduceStudioState(state, { type: "source.admission.set", sourceId: screen.id, admitted: true });

    // Both maps still expose the old sharing=true object when the stop fires.
    meeting.participants.joined.emit("screenShareUpdate", sharing, { screenShareEnabled: false });
    const stopped = events.at(-1)!;
    expect(stopped.sources.some((source) => source.id === screen.id)).toBe(true);
    expect(stopped.departedSourceIds).toEqual([screen.id]);
    state = reduceStudioState(state, {
      type: "sources.reconcile", sources: stopped.sources, departedSourceIds: stopped.departedSourceIds,
    });
    meeting.participants.joined.emit("screenShareUpdate", sharing, { screenShareEnabled: true });
    const nextShare = events.at(-1)!;
    state = reduceStudioState(state, { type: "sources.reconcile", sources: nextShare.sources });
    expect(state.onStageSourceIds).toContain(camera.id);
    expect(state.onStageSourceIds).not.toContain(screen.id);
    room.app.unmount();
  });
});
