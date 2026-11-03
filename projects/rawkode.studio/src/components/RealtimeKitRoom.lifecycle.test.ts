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

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function screenProducer(peerId: string, producerId: string, video?: MediaStreamTrack) {
  return {
    producerId, producingPeerId: peerId, producingTransportId: "transport",
    kind: "video", pause: false, screenShare: true,
    ...(video ? { consumer: {
      id: `consumer-${producerId}`, producerId, peerId, kind: "video", paused: false,
      appData: { screenShare: true }, rtpReceiver: { track: video },
    } } : {}),
  };
}

function videoTrack(id: string): MediaStreamTrack {
  return { id, kind: "video", readyState: "live" } as MediaStreamTrack;
}

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

  it("deduplicates joined and active events and preserves unchanged streams across other changes", async () => {
    const meeting = fakeMeeting();
    const video = videoTrack("screen");
    const sharing = Object.assign(meeting.peer, {
      screenShareEnabled: true, screenShareTracks: { video },
      producers: [screenProducer(meeting.peer.id, "video", video)],
    });
    mocks.init.mockResolvedValue(meeting);
    const events: MediaPayload[] = [];
    const room = mount((event) => events.push(event));
    room.click();
    await flush();
    const initial = events.at(-1)!;
    const cameraId = initial.sources.find((source) => source.type === "camera")!.id;
    const screenId = initial.sources.find((source) => source.type === "screen")!.id;
    const cameraStream = initial.streams.get(cameraId);
    const screenStream = initial.streams.get(screenId);
    expect(cameraStream).toBeDefined();
    expect(screenStream).toBeDefined();
    const count = events.length;
    meeting.participants.joined.emit("participantsUpdate");
    meeting.participants.active.emit("participantsUpdate");
    meeting.participants.joined.emit("audioUpdate", sharing);
    meeting.participants.active.emit("videoUpdate", sharing);
    expect(events).toHaveLength(count);

    // A change to source metadata emits an update but does not replace media.
    sharing.name = "Renamed Guest";
    meeting.participants.joined.emit("participantsUpdate");
    const renamed = events.at(-1)!;
    expect(renamed.streams.get(cameraId)).toBe(cameraStream);
    expect(renamed.streams.get(screenId)).toBe(screenStream);

    const nextVideo = videoTrack("next-screen");
    sharing.producers = [screenProducer(sharing.id, "next-video", nextVideo)];
    sharing.screenShareTracks = { video: nextVideo };
    meeting.participants.active.emit("screenShareUpdate", sharing, { screenShareEnabled: true });
    const changed = events.at(-1)!;
    const nextScreenId = changed.sources.find((source) => source.type === "screen")!.id;
    expect(nextScreenId).not.toBe(screenId);
    expect(changed.departedSourceIds).toContain(screenId);
    expect(changed.streams.get(cameraId)).toBe(cameraStream);
    expect(changed.streams.get(nextScreenId)).not.toBe(screenStream);

    // A departure must still be emitted even if its accompanying snapshot is unchanged.
    meeting.participants.joined.emit("participantLeft", sharing);
    expect(events.at(-1)!.departedSourceIds).toContain(nextScreenId);
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
    const offlineCount = events.length;
    windowEvents.emit("offline");
    expect(events).toHaveLength(offlineCount);
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

  it("revokes a disappeared publication without attributing a late false event to the new share", async () => {
    const meeting = fakeMeeting();
    const oldVideo = videoTrack("old");
    const newVideo = videoTrack("new");
    const sharing = Object.assign(meeting.peer, {
      screenShareEnabled: true,
      screenShareTracks: { video: oldVideo },
      producers: [screenProducer(meeting.peer.id, "old", oldVideo)],
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

    // The old producer has vanished and the new track is already present when
    // the old consumer's false event is delivered.
    sharing.producers = [screenProducer(meeting.peer.id, "new", newVideo)];
    sharing.screenShareTracks = { video: newVideo };
    meeting.participants.joined.emit("screenShareUpdate", sharing, { screenShareEnabled: false });
    const stopped = events.at(-1)!;
    const nextScreen = stopped.sources.find((source) => source.type === "screen")!;
    expect(nextScreen.id).not.toBe(screen.id);
    expect(stopped.departedSourceIds).toContain(screen.id);
    expect(stopped.departedSourceIds).not.toContain(nextScreen.id);
    expect(stopped.streams.has(nextScreen.id)).toBe(false);
    state = reduceStudioState(state, {
      type: "sources.reconcile", sources: stopped.sources, departedSourceIds: stopped.departedSourceIds,
    });
    meeting.participants.joined.emit("screenShareUpdate", sharing, { screenShareEnabled: true });
    const nextShare = events.at(-1)!;
    state = reduceStudioState(state, { type: "sources.reconcile", sources: nextShare.sources });
    expect(state.onStageSourceIds).toContain(camera.id);
    expect(state.onStageSourceIds).not.toContain(screen.id);
    expect(state.onStageSourceIds).not.toContain(nextScreen.id);
    expect(nextShare.streams.has(nextScreen.id)).toBe(true);
    room.app.unmount();
  });

  it("keeps screen membership without a local subscription and revokes it when the producer disappears", async () => {
    const meeting = fakeMeeting();
    const sharing = Object.assign(meeting.peer, {
      screenShareEnabled: false,
      screenShareTracks: undefined as { video: MediaStreamTrack } | undefined,
      producers: [screenProducer(meeting.peer.id, "video")],
    });
    mocks.init.mockResolvedValue(meeting);
    const events: MediaPayload[] = [];
    const room = mount((event) => events.push(event));
    room.click();
    await flush();
    const screen = events.at(-1)!.sources.find((source) => source.type === "screen")!;
    expect(screen).toBeDefined();
    expect(events.at(-1)!.streams.has(screen.id)).toBe(false);
    Object.assign(sharing, { producers: undefined });
    meeting.participants.joined.emit("participantsUpdate");
    expect(events.at(-1)!.departedSourceIds).not.toContain(screen.id);
    sharing.producers = [];
    meeting.participants.joined.emit("screenShareUpdate", sharing, { screenShareEnabled: false });
    expect(events.at(-1)!.departedSourceIds).toContain(screen.id);
    room.app.unmount();
  });

  it("revokes every observed screen on departure and room authority loss", async () => {
    const meeting = fakeMeeting();
    const sharing = Object.assign(meeting.peer, {
      screenShareEnabled: false,
      producers: [screenProducer(meeting.peer.id, "video")],
    });
    mocks.init.mockResolvedValue(meeting);
    const events: MediaPayload[] = [];
    const room = mount((event) => events.push(event));
    room.click();
    await flush();
    const screenId = events.at(-1)!.sources.find((source) => source.type === "screen")!.id;
    // Metadata can be gone already by the time participantLeft is delivered.
    sharing.producers = [];
    meeting.participants.joined.delete(sharing.id);
    meeting.participants.joined.emit("participantLeft", sharing);
    expect(events.at(-1)!.departedSourceIds).toContain(screenId);

    sharing.producers = [screenProducer(sharing.id, "video-next")];
    meeting.participants.joined.set(sharing.id, sharing);
    meeting.participants.joined.emit("participantJoined", sharing);
    const nextId = events.at(-1)!.sources.find((source) => source.type === "screen")!.id;
    meeting.meta.emit("socketConnectionUpdate", { state: "reconnecting" });
    expect(events.at(-1)).toMatchObject({ authoritative: false, departedSourceIds: expect.arrayContaining([nextId]) });
    meeting.meta.emit("socketConnectionUpdate", { state: "connected" });
    meeting.self.emit("roomJoined");
    expect(events.at(-1)!.sources.find((source) => source.type === "screen")?.id).toBe(nextId);
    room.app.unmount();
  });

  it("resnapshots silent producer changes without churning stable streams and clears its timer", async () => {
    vi.useFakeTimers();
    const meeting = fakeMeeting();
    const oldVideo = videoTrack("old");
    const nextVideo = videoTrack("new");
    const sharing = Object.assign(meeting.peer, {
      screenShareEnabled: true,
      screenShareTracks: { video: oldVideo },
      producers: [screenProducer(meeting.peer.id, "old", oldVideo)],
    });
    mocks.init.mockResolvedValue(meeting);
    const events: MediaPayload[] = [];
    const room = mount((event) => events.push(event));
    room.click();
    await flush();
    const first = events.at(-1)!;
    const oldId = first.sources.find((source) => source.type === "screen")!.id;
    const eventCount = events.length;
    vi.advanceTimersByTime(500);
    expect(events).toHaveLength(eventCount);
    sharing.producers = [screenProducer(sharing.id, "new", nextVideo)];
    // New producer metadata must not be paired with the old track.
    vi.advanceTimersByTime(500);
    const changed = events.at(-1)!;
    const nextId = changed.sources.find((source) => source.type === "screen")!.id;
    expect(changed.departedSourceIds).toContain(oldId);
    expect(changed.streams.has(nextId)).toBe(false);
    sharing.screenShareTracks = { video: nextVideo };
    vi.advanceTimersByTime(500);
    expect(events.at(-1)!.streams.has(nextId)).toBe(true);
    room.app.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("immediately fences muted or ended screen tracks and removes track listeners on unmount", async () => {
    const meeting = fakeMeeting();
    const eventsOnTrack = new Emitter();
    const video = {
      id: "screen", kind: "video", readyState: "live", enabled: true, muted: false,
      addEventListener: (event: string, listener: Listener) => eventsOnTrack.on(event, listener),
      removeEventListener: (event: string, listener: Listener) => eventsOnTrack.off(event, listener),
    };
    const mediaTrack = video as unknown as MediaStreamTrack;
    Object.assign(meeting.peer, {
      screenShareEnabled: true, screenShareTracks: { video: mediaTrack },
      producers: [screenProducer(meeting.peer.id, "video", mediaTrack)],
    });
    mocks.init.mockResolvedValue(meeting);
    const events: MediaPayload[] = [];
    const room = mount((event) => events.push(event));
    room.click();
    await flush();
    const screenId = events.at(-1)!.sources.find((source) => source.type === "screen")!.id;
    expect(events.at(-1)!.streams.has(screenId)).toBe(true);
    video.muted = true;
    eventsOnTrack.emit("mute");
    expect(events.at(-1)!.streams.has(screenId)).toBe(false);
    video.muted = false;
    eventsOnTrack.emit("unmute");
    expect(events.at(-1)!.streams.has(screenId)).toBe(true);
    video.readyState = "ended";
    eventsOnTrack.emit("ended");
    expect(events.at(-1)!.streams.has(screenId)).toBe(false);
    room.app.unmount();
    expect([...eventsOnTrack.listeners.values()].every((listeners) => listeners.size === 0)).toBe(true);
  });
});
