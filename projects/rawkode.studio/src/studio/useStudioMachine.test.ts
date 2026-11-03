import { createRenderer, h, nextTick, onBeforeUnmount, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioState } from "../types";
import { mapRealtimeKitParticipantSources } from "../realtimekit/participantSources";
import { createInitialStudioState } from "./seed";
import { reduceStudioState } from "./studioMachine";
import { useStudioMachine } from "./useStudioMachine";

type TestNode = { children: TestNode[]; parent?: TestNode | null; text?: string };

const renderer = createRenderer<TestNode, TestNode>({
  createElement: () => ({ children: [] }),
  createText: (text) => ({ children: [], text }),
  createComment: (text) => ({ children: [], text }),
  setText: (node, text) => { node.text = text; },
  setElementText: (node, text) => { node.text = text; },
  insert: (node, parent, anchor) => {
    node.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, node);
  },
  remove: (node) => {
    const siblings = node.parent?.children;
    if (siblings) siblings.splice(siblings.indexOf(node), 1);
    node.parent = null;
  },
  parentNode: (node) => node.parent ?? null,
  nextSibling: (node) => {
    const siblings = node.parent?.children;
    return siblings?.[siblings.indexOf(node) + 1] ?? null;
  },
  patchProp: () => {},
});

type StudioMachine = ReturnType<typeof useStudioMachine>;
const mountedApps: Array<{ unmount(): void }> = [];
const watchStops: Array<() => void> = [];

function mountMachine(onPublisherUnmount = () => {}): StudioMachine {
  let machine: StudioMachine | undefined;
  const publisher = {
    setup() {
      onBeforeUnmount(onPublisherUnmount);
      return () => h("span");
    },
  };
  const app = renderer.createApp({
    setup() {
      machine = useStudioMachine(undefined, { sessionId: "session", synchronize: true });
      return () => machine!.isSynchronized.value ? h(publisher) : h("div");
    },
  });
  app.mount({ children: [] });
  mountedApps.push(app);
  if (!machine) throw new Error("Studio machine did not mount.");
  return machine;
}

function snapshot(revision: number, state: StudioState, status = 200): Response {
  return new Response(JSON.stringify({ revision, state, updatedAt: null, updatedBy: null }), { status });
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
  await nextTick();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  vi.stubGlobal("window", globalThis);
});

afterEach(async () => {
  for (const stop of watchStops.splice(0)) stop();
  for (const app of mountedApps.splice(0)) app.unmount();
  await flush();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("two-producer synchronization", () => {
  it("does not let a standby awaiting tracks evict an admitted peer", async () => {
    const participant = {
      id: "peer-one",
      name: "Guest",
      customParticipantId: "studio:guest:example",
      videoEnabled: true,
      audioEnabled: true,
      videoTrack: { kind: "video", readyState: "live" } as MediaStreamTrack,
      audioTrack: { kind: "audio", readyState: "live" } as MediaStreamTrack,
    };
    const primary = mapRealtimeKitParticipantSources([participant]);
    const standby = mapRealtimeKitParticipantSources([{
      ...participant, videoTrack: undefined, audioTrack: undefined,
    }]);
    let authoritative = reduceStudioState(createInitialStudioState(), {
      type: "sources.reconcile", authoritativeRuntimeSource: "realtimekit", sources: primary.sources,
    });
    const sourceId = primary.sources[0].id;
    authoritative = reduceStudioState(authoritative, { type: "source.admission.set", sourceId, admitted: true });
    let revision = 1;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method !== "POST") return Promise.resolve(snapshot(revision, authoritative));
      const body = JSON.parse(String(init.body)) as { expectedRevision: number; state: StudioState };
      if (body.expectedRevision !== revision) return Promise.resolve(snapshot(revision, authoritative, 409));
      authoritative = body.state;
      revision += 1;
      return Promise.resolve(snapshot(revision, authoritative));
    }));
    const first = mountMachine();
    const second = mountMachine();
    await flush();
    first.send({ type: "sources.reconcile", authoritativeRuntimeSource: "realtimekit", sources: primary.sources });
    second.send({ type: "sources.reconcile", authoritativeRuntimeSource: "realtimekit", sources: standby.sources });
    await vi.advanceTimersByTimeAsync(2_500);
    expect(standby.streams).toEqual([]);
    expect(authoritative.onStageSourceIds).toEqual([sourceId]);
    expect(first.state.value.onStageSourceIds).toEqual([sourceId]);
    expect(second.state.value.onStageSourceIds).toEqual([sourceId]);
    expect(revision).toBe(1);
    expect(first.syncConflictNotice.value).toBe("");
    expect(second.syncConflictNotice.value).toBe("");
  });

  it("keeps room-loss revocations when a peer rejoins and another producer wins the save", async () => {
    const peer = {
      id: "source-realtimekit-camera-v2.cGVlci1vbmU",
      name: "Guest",
      type: "camera" as const,
      status: "ready" as const,
      roles: ["guests" as const],
      settings: { runtimeSource: "realtimekit" },
    };
    let authoritative = reduceStudioState(createInitialStudioState(), {
      type: "sources.reconcile", sources: [peer],
    });
    authoritative = reduceStudioState(authoritative, {
      type: "source.admission.set", sourceId: peer.id, admitted: true,
    });
    let revision = 1;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method !== "POST") return Promise.resolve(snapshot(revision, authoritative));
      const body = JSON.parse(String(init.body)) as { expectedRevision: number; state: StudioState };
      if (body.expectedRevision !== revision) return Promise.resolve(snapshot(revision, authoritative, 409));
      authoritative = body.state;
      revision += 1;
      return Promise.resolve(snapshot(revision, authoritative));
    }));
    const first = mountMachine();
    const second = mountMachine();
    await flush();

    first.send({ type: "scene.select", sceneId: "guests" });
    second.send({ type: "sources.reconcile", sources: [], departedSourceIds: [peer.id] });
    second.send({ type: "sources.reconcile", sources: [peer] });
    await vi.advanceTimersByTimeAsync(200);
    expect(authoritative.previewSceneId).toBe("guests");
    expect(authoritative.onStageSourceIds).not.toContain(peer.id);
    expect(second.state.value.onStageSourceIds).not.toContain(peer.id);
    expect(second.syncConflictNotice.value).toBe("");
  });

  it("converges simultaneous per-tab camera registration without a producer conflict", async () => {
    let authoritative = createInitialStudioState();
    authoritative.onStageSourceIds = ["source-host-camera"];
    let revision = 1;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method !== "POST") return Promise.resolve(snapshot(revision, authoritative));
      const body = JSON.parse(String(init.body)) as { expectedRevision: number; state: StudioState };
      if (body.expectedRevision !== revision) return Promise.resolve(snapshot(revision, authoritative, 409));
      authoritative = body.state;
      revision += 1;
      return Promise.resolve(snapshot(revision, authoritative));
    }));
    const first = mountMachine();
    const second = mountMachine();
    for (const [machine, ownerId] of [[first, "tab-one"], [second, "tab-two"]] as const) {
      const camera = {
        id: `source-producer-camera-${ownerId}`,
        name: "Producer Camera",
        type: "camera" as const,
        status: "missing" as const,
        roles: ["producer" as const],
        settings: { runtimeOwnerId: ownerId, runtimeSource: "local", captureStatus: "blocked" },
      };
      watchStops.push(watch(
        () => [machine.isSynchronized.value, machine.remoteStateEpoch.value],
        () => {
          if (machine.isSynchronized.value) {
            machine.send({ type: "sources.reconcile", sources: [camera] });
          }
        },
        { immediate: true },
      ));
    }

    await flush();
    await vi.advanceTimersByTimeAsync(2_500);
    expect(authoritative.sources.map((source) => source.id)).toEqual(expect.arrayContaining([
      "source-producer-camera-tab-one",
      "source-producer-camera-tab-two",
    ]));
    expect(authoritative.onStageSourceIds).toEqual(["source-host-camera"]);
    expect(first.syncConflictNotice.value).toBe("");
    expect(second.syncConflictNotice.value).toBe("");
    expect(first.state.value.sources).toEqual(authoritative.sources);
    expect(second.state.value.sources).toEqual(authoritative.sources);
    expect(revision).toBe(3);
  });

  it("reports a real edit conflict even when the same save also registers a camera", async () => {
    let authoritative = createInitialStudioState();
    let revision = 1;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method !== "POST") return Promise.resolve(snapshot(revision, authoritative));
      const body = JSON.parse(String(init.body)) as { expectedRevision: number; state: StudioState };
      if (body.expectedRevision !== revision) return Promise.resolve(snapshot(revision, authoritative, 409));
      authoritative = body.state;
      revision += 1;
      return Promise.resolve(snapshot(revision, authoritative));
    }));
    const first = mountMachine();
    const second = mountMachine();
    const camera = {
      id: "source-producer-camera-tab-two",
      name: "Producer Camera",
      type: "camera" as const,
      status: "missing" as const,
      roles: ["producer" as const],
      settings: { runtimeOwnerId: "tab-two", runtimeSource: "local", captureStatus: "blocked" },
    };
    await flush();
    first.send({ type: "scene.select", sceneId: "guests" });
    watchStops.push(watch(
      () => [second.isSynchronized.value, second.remoteStateEpoch.value],
      () => {
        if (second.isSynchronized.value) second.send({ type: "sources.reconcile", sources: [camera] });
      },
      { immediate: true },
    ));
    second.send({ type: "scene.select", sceneId: "screenshare" });
    await vi.advanceTimersByTimeAsync(2_500);
    expect(authoritative.previewSceneId).toBe("guests");
    expect(second.state.value.previewSceneId).toBe("guests");
    expect(second.syncConflictNotice.value).toContain("Local changes were discarded");
    expect(authoritative.sources.some((source) => source.id === camera.id)).toBe(true);
    expect(authoritative.onStageSourceIds).not.toContain(camera.id);
  });

  it("preserves an admission revoked by automatic source removal across a revision race", async () => {
    let authoritative = createInitialStudioState();
    authoritative.onStageSourceIds = ["source-host-camera"];
    let revision = 1;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method !== "POST") return Promise.resolve(snapshot(revision, authoritative));
      const body = JSON.parse(String(init.body)) as { expectedRevision: number; state: StudioState };
      if (body.expectedRevision !== revision) return Promise.resolve(snapshot(revision, authoritative, 409));
      authoritative = body.state;
      revision += 1;
      return Promise.resolve(snapshot(revision, authoritative));
    }));
    const first = mountMachine();
    const second = mountMachine();
    await flush();

    first.send({ type: "scene.select", sceneId: "guests" });
    second.send({ type: "sources.reconcile", authoritativeRuntimeSource: "realtimekit", sources: [] });
    await vi.advanceTimersByTimeAsync(200);
    expect(authoritative.previewSceneId).toBe("guests");
    expect(authoritative.onStageSourceIds).toEqual([]);
    expect(second.state.value.onStageSourceIds).toEqual([]);
    expect(second.syncConflictNotice.value).toBe("");
  });

  it("keeps a removed backstage source revoked if another producer admits it concurrently", async () => {
    let authoritative = createInitialStudioState();
    let revision = 1;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method !== "POST") return Promise.resolve(snapshot(revision, authoritative));
      const body = JSON.parse(String(init.body)) as { expectedRevision: number; state: StudioState };
      if (body.expectedRevision !== revision) return Promise.resolve(snapshot(revision, authoritative, 409));
      authoritative = body.state;
      revision += 1;
      return Promise.resolve(snapshot(revision, authoritative));
    }));
    const first = mountMachine();
    const second = mountMachine();
    await flush();

    first.send({ type: "source.admission.set", sourceId: "source-host-camera", admitted: true });
    second.send({ type: "sources.reconcile", authoritativeRuntimeSource: "realtimekit", sources: [] });
    await vi.advanceTimersByTimeAsync(200);
    expect(authoritative.onStageSourceIds).not.toContain("source-host-camera");
    expect(second.state.value.onStageSourceIds).not.toContain("source-host-camera");
    expect(second.syncConflictNotice.value).toBe("");
  });

  it("retries a departure even if the source was already backstage locally", async () => {
    let authoritative = createInitialStudioState();
    let revision = 1;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method !== "POST") return Promise.resolve(snapshot(revision, authoritative));
      const body = JSON.parse(String(init.body)) as { expectedRevision: number; state: StudioState };
      if (body.expectedRevision !== revision) return Promise.resolve(snapshot(revision, authoritative, 409));
      authoritative = body.state;
      revision += 1;
      return Promise.resolve(snapshot(revision, authoritative));
    }));
    const first = mountMachine();
    const second = mountMachine();
    await flush();
    first.send({ type: "source.admission.set", sourceId: "source-host-camera", admitted: true });
    second.send({ type: "sources.reconcile", sources: [], departedSourceIds: ["source-host-camera"] });
    await vi.advanceTimersByTimeAsync(200);
    expect(authoritative.onStageSourceIds).toEqual([]);
    expect(second.state.value.onStageSourceIds).toEqual([]);
  });

  it("does not lose a backstage removal when another producer wins the revision", async () => {
    let state = createInitialStudioState();
    state = reduceStudioState(state, { type: "scene.select", sceneId: "guests" });
    state = reduceStudioState(state, { type: "scene.take" });
    state.onStageSourceIds = ["source-host-camera"];
    let authoritative = JSON.parse(JSON.stringify(state)) as StudioState;
    let revision = 1;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method !== "POST") return Promise.resolve(snapshot(revision, authoritative));
      const body = JSON.parse(String(init.body)) as { expectedRevision: number; state: StudioState };
      if (body.expectedRevision !== revision) return Promise.resolve(snapshot(revision, authoritative, 409));
      authoritative = body.state;
      revision += 1;
      return Promise.resolve(snapshot(revision, authoritative));
    }));
    const first = mountMachine();
    const second = mountMachine();
    await flush();
    first.send({ type: "stinger.midpoint", generation: first.state.value.activeStinger?.generation });
    second.send({ type: "source.admission.set", sourceId: "source-host-camera", admitted: false });
    await vi.advanceTimersByTimeAsync(200);
    expect(authoritative.programSceneId).toBe("guests");
    expect(authoritative.onStageSourceIds).toEqual([]);
    expect(second.state.value.onStageSourceIds).toEqual([]);
    expect(second.syncConflictNotice.value).toBe("");
  });

  it("preserves a backstage removal while reporting other discarded edits", async () => {
    let authoritative = createInitialStudioState();
    authoritative.onStageSourceIds = ["source-host-camera"];
    let revision = 1;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method !== "POST") return Promise.resolve(snapshot(revision, authoritative));
      const body = JSON.parse(String(init.body)) as { expectedRevision: number; state: StudioState };
      if (body.expectedRevision !== revision) return Promise.resolve(snapshot(revision, authoritative, 409));
      authoritative = body.state;
      revision += 1;
      return Promise.resolve(snapshot(revision, authoritative));
    }));
    const first = mountMachine();
    const second = mountMachine();
    await flush();
    first.send({ type: "scene.select", sceneId: "guests" });
    second.send({ type: "source.admission.set", sourceId: "source-host-camera", admitted: false });
    second.send({ type: "scene.select", sceneId: "screenshare" });
    await vi.advanceTimersByTimeAsync(200);
    expect(authoritative.previewSceneId).toBe("guests");
    expect(authoritative.onStageSourceIds).toEqual([]);
    expect(second.state.value.onStageSourceIds).toEqual([]);
    expect(second.syncConflictNotice.value).toContain("Local changes were discarded");
  });

  it("does not replay an old stinger callback onto a different transition with the same generation", async () => {
    let state = createInitialStudioState();
    state = reduceStudioState(state, { type: "scene.select", sceneId: "guests" });
    state = reduceStudioState(state, { type: "scene.take" });
    let authoritative = JSON.parse(JSON.stringify(state)) as StudioState;
    let revision = 1;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method !== "POST") return Promise.resolve(snapshot(revision, authoritative));
      const body = JSON.parse(String(init.body)) as { expectedRevision: number; state: StudioState };
      if (body.expectedRevision !== revision) return Promise.resolve(snapshot(revision, authoritative, 409));
      authoritative = body.state;
      revision += 1;
      return Promise.resolve(snapshot(revision, authoritative));
    }));
    const producer = mountMachine();
    await flush();
    const generation = producer.state.value.activeStinger?.generation;

    authoritative = {
      ...authoritative,
      previewSceneId: "screenshare",
      activeStinger: { ...authoritative.activeStinger!, toSceneId: "screenshare" },
    };
    revision += 1;
    producer.send({ type: "stinger.midpoint", generation });
    await vi.advanceTimersByTimeAsync(100);
    expect(producer.state.value.programSceneId).toBe("intro");
    expect(producer.state.value.activeStinger?.toSceneId).toBe("screenshare");
    expect(producer.syncConflictNotice.value).toBe("");
    expect(authoritative.programSceneId).toBe("intro");
  });

  it("retries an automatic transition against a newer backstage decision", async () => {
    let state = createInitialStudioState();
    state = reduceStudioState(state, { type: "scene.select", sceneId: "guests" });
    state = reduceStudioState(state, { type: "scene.take" });
    state.onStageSourceIds = ["source-host-camera"];
    let authoritative = JSON.parse(JSON.stringify(state)) as StudioState;
    let revision = 1;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method !== "POST") return Promise.resolve(snapshot(revision, authoritative));
      const body = JSON.parse(String(init.body)) as { expectedRevision: number; state: StudioState };
      if (body.expectedRevision !== revision) return Promise.resolve(snapshot(revision, authoritative, 409));
      authoritative = body.state;
      revision += 1;
      return Promise.resolve(snapshot(revision, authoritative));
    });
    vi.stubGlobal("fetch", fetchMock);
    const first = mountMachine();
    const second = mountMachine();
    await flush();

    const generation = second.state.value.activeStinger?.generation;
    first.send({ type: "source.admission.set", sourceId: "source-host-camera", admitted: false });
    second.send({ type: "stinger.midpoint", generation });
    await vi.advanceTimersByTimeAsync(200);
    expect(authoritative.onStageSourceIds).toEqual([]);
    expect(authoritative.programSceneId).toBe("guests");
    expect(second.syncConflictNotice.value).toBe("");

    second.send({ type: "stinger.finished", generation });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(authoritative.activeStinger).toBeUndefined();
    expect(first.state.value.onStageSourceIds).toEqual([]);
    expect(second.state.value.onStageSourceIds).toEqual([]);
    expect(first.state.value.programSceneId).toBe("guests");
  });

  it("keeps an actual competing producer edit as an explicit conflict", async () => {
    let authoritative = createInitialStudioState();
    let revision = 1;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method !== "POST") return Promise.resolve(snapshot(revision, authoritative));
      const body = JSON.parse(String(init.body)) as { expectedRevision: number; state: StudioState };
      if (body.expectedRevision !== revision) return Promise.resolve(snapshot(revision, authoritative, 409));
      authoritative = body.state;
      revision += 1;
      return Promise.resolve(snapshot(revision, authoritative));
    }));
    const first = mountMachine();
    const second = mountMachine();
    await flush();
    first.send({ type: "scene.select", sceneId: "guests" });
    second.send({ type: "scene.select", sceneId: "screenshare" });
    await vi.advanceTimersByTimeAsync(100);
    expect(authoritative.previewSceneId).toBe("guests");
    expect(second.state.value.previewSceneId).toBe("guests");
    expect(second.syncConflictNotice.value).toContain("Local changes were discarded");
  });

  it("does not turn equivalent source reconciliation or duplicate stinger timers into conflicts", async () => {
    let state = createInitialStudioState();
    state = reduceStudioState(state, { type: "scene.select", sceneId: "monologue" });
    state = reduceStudioState(state, { type: "scene.take" });
    const firstGeneration = state.activeStinger?.generation;
    state = reduceStudioState(state, { type: "stinger.midpoint", generation: firstGeneration });
    state = reduceStudioState(state, { type: "stinger.finished", generation: firstGeneration });
    state.onStageSourceIds = ["source-host-camera"];
    const camera = {
      ...state.sources.find((source) => source.id === "source-producer-camera")!,
      status: "missing" as const,
      settings: { captureError: "Requested device not found", captureStatus: "blocked", runtimeSource: "local" },
    };
    state = reduceStudioState(state, { type: "sources.reconcile", sources: [camera] });
    let authoritative = JSON.parse(JSON.stringify(state)) as StudioState;
    let revision = 1;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method !== "POST") return Promise.resolve(snapshot(revision, authoritative));
      const body = JSON.parse(String(init.body)) as { expectedRevision: number; state: StudioState };
      if (body.expectedRevision !== revision) return Promise.resolve(snapshot(revision, authoritative, 409));
      authoritative = body.state;
      revision += 1;
      return Promise.resolve(snapshot(revision, authoritative));
    });
    vi.stubGlobal("fetch", fetchMock);
    const first = mountMachine();
    const second = mountMachine();
    for (const machine of [first, second]) {
      watchStops.push(watch(
        () => [machine.isSynchronized.value, machine.remoteStateEpoch.value],
        () => {
          if (machine.isSynchronized.value) {
            machine.send({ type: "sources.reconcile", sources: [camera] });
          }
        },
        { immediate: true },
      ));
    }
    await flush();
    await vi.advanceTimersByTimeAsync(500);
    expect(revision).toBe(1);

    first.send({ type: "scene.select", sceneId: "guests" });
    await vi.advanceTimersByTimeAsync(1_500);
    expect(second.state.value.previewSceneId).toBe("guests");
    second.send({ type: "scene.take" });
    await vi.advanceTimersByTimeAsync(2_000);
    const generation = second.state.value.activeStinger?.generation;
    expect(generation).toEqual(expect.any(Number));
    expect(first.state.value.activeStinger?.generation).toBe(generation);

    // Each producer schedules the same midpoint and finish callbacks.
    first.send({ type: "stinger.midpoint", generation });
    second.send({ type: "stinger.midpoint", generation });
    await vi.advanceTimersByTimeAsync(100);
    first.send({ type: "stinger.finished", generation });
    second.send({ type: "stinger.finished", generation });
    await vi.advanceTimersByTimeAsync(2_100);

    expect(authoritative.programSceneId).toBe("guests");
    expect(authoritative.activeStinger).toBeUndefined();
    expect(first.state.value.programSceneId).toBe("guests");
    expect(second.state.value.programSceneId).toBe("guests");
    expect(first.syncConflictNotice.value).toBe("");
    expect(second.syncConflictNotice.value).toBe("");
    expect(authoritative.onStageSourceIds).toEqual(["source-host-camera"]);
  });
});

describe("Studio control-state freshness", () => {
  it("fences a hung poll and ignores its late response after a newer generation", async () => {
    const oldState = { ...createInitialStudioState(), onStageSourceIds: ["source-host-camera"] };
    const backstageState = { ...oldState, onStageSourceIds: [] };
    const latePoll = deferred<Response>();
    const retry = deferred<Response>();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(snapshot(1, oldState))
      .mockReturnValueOnce(latePoll.promise)
      .mockReturnValueOnce(retry.promise);
    vi.stubGlobal("fetch", fetchMock);
    const publisherUnmounted = vi.fn();
    const machine = mountMachine(publisherUnmounted);
    await flush();
    expect(machine.isSynchronized.value).toBe(true);

    await vi.advanceTimersByTimeAsync(2_000);
    const abandonedSignal = fetchMock.mock.calls[1][1].signal as AbortSignal;
    await vi.advanceTimersByTimeAsync(6_000);
    expect(abandonedSignal.aborted).toBe(true);
    expect(machine.syncStatus.value).toBe("error");
    expect(machine.isSynchronized.value).toBe(false);
    expect(publisherUnmounted).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    latePoll.resolve(snapshot(7, oldState));
    await flush();
    expect(machine.revision.value).toBe(1);
    expect(machine.isSynchronized.value).toBe(false);

    retry.resolve(snapshot(2, backstageState));
    await flush();
    expect(machine.revision.value).toBe(2);
    expect(machine.state.value.onStageSourceIds).toEqual([]);
    expect(machine.isSynchronized.value).toBe(true);
  });

  it("recovers after a failed poll returns the same authoritative revision", async () => {
    const state = createInitialStudioState();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(snapshot(1, state))
      .mockRejectedValueOnce(new Error("temporary network error"))
      .mockResolvedValueOnce(snapshot(1, state));
    vi.stubGlobal("fetch", fetchMock);
    const machine = mountMachine();
    await flush();

    await vi.advanceTimersByTimeAsync(2_000);
    expect(machine.syncStatus.value).toBe("error");
    expect(machine.isSynchronized.value).toBe(false);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(machine.syncStatus.value).toBe("ready");
    expect(machine.syncError.value).toBe("");
    expect(machine.isSynchronized.value).toBe(true);
  });

  it("keeps healthy polls fresh and fences a response body that never finishes", async () => {
    const state = createInitialStudioState();
    const body = deferred<unknown>();
    const retry = deferred<Response>();
    const stalledResponse = { ok: true, json: () => body.promise } as Response;
    let reads = 0;
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => {
      reads += 1;
      if (reads <= 7) return Promise.resolve(snapshot(1, state));
      return reads === 8 ? Promise.resolve(stalledResponse) : retry.promise;
    });
    vi.stubGlobal("fetch", fetchMock);
    const machine = mountMachine();
    await flush();

    await vi.advanceTimersByTimeAsync(12_000);
    expect(machine.isSynchronized.value).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(7);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetchMock).toHaveBeenCalledTimes(8);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(machine.isSynchronized.value).toBe(false);
    expect(machine.syncStatus.value).toBe("error");
    body.resolve({ revision: 3, state });
    await flush();
    expect(machine.revision.value).toBe(1);
    expect(machine.isSynchronized.value).toBe(false);
  });

  it("does not count an older revision as fresh after a newer local save", async () => {
    const state = createInitialStudioState();
    const oldPoll = deferred<Response>();
    let reads = 0;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const saved = JSON.parse(String(init.body)) as { state: StudioState };
        return Promise.resolve(snapshot(2, saved.state));
      }
      reads += 1;
      if (reads === 2) return oldPoll.promise;
      return Promise.resolve(snapshot(1, state));
    });
    vi.stubGlobal("fetch", fetchMock);
    const machine = mountMachine();
    await flush();
    await vi.advanceTimersByTimeAsync(2_000);
    machine.send({ type: "playback.toggle" });
    await vi.advanceTimersByTimeAsync(100);
    expect(machine.revision.value).toBe(2);

    oldPoll.resolve(snapshot(1, state));
    await flush();
    expect(machine.revision.value).toBe(2);
    expect(machine.isSynchronized.value).toBe(true);
    await vi.advanceTimersByTimeAsync(8_000);
    expect(machine.isSynchronized.value).toBe(false);
    expect(machine.syncStatus.value).toBe("error");
  });

  it("rejects an over-age response even when the timeout timer was delayed", async () => {
    const state = createInitialStudioState();
    const delayedPoll = deferred<Response>();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(snapshot(1, state))
      .mockReturnValueOnce(delayedPoll.promise);
    vi.stubGlobal("fetch", fetchMock);
    const machine = mountMachine();
    await flush();
    await vi.advanceTimersByTimeAsync(2_000);

    // Advancing wall time without running timers models a suspended event loop.
    vi.setSystemTime(new Date("2026-01-01T00:00:20Z"));
    delayedPoll.resolve(snapshot(2, state));
    await flush();
    expect(machine.revision.value).toBe(1);
    expect(machine.isSynchronized.value).toBe(false);
    expect(machine.syncStatus.value).toBe("error");
  });

  it("keeps recovery closed until all unsaved edits have actually been confirmed", async () => {
    const state = createInitialStudioState();
    const firstSave = deferred<Response>();
    const retrySave = deferred<Response>();
    const finalSave = deferred<Response>();
    const writes: Array<{ body: { state: StudioState }; signal: AbortSignal }> = [];
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method !== "POST") return Promise.resolve(snapshot(1, state));
      writes.push({ body: JSON.parse(String(init.body)), signal: init.signal as AbortSignal });
      return [firstSave.promise, retrySave.promise, finalSave.promise][writes.length - 1];
    });
    vi.stubGlobal("fetch", fetchMock);
    const machine = mountMachine();
    await flush();
    machine.send({ type: "audioMix.source.gain", sourceId: "source-host-camera", gain: 1.5 });
    await vi.advanceTimersByTimeAsync(100);
    expect(writes).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(8_000);
    expect(writes[0].signal.aborted).toBe(true);
    expect(machine.isSynchronized.value).toBe(false);
    expect(machine.state.value.audioMix["source-host-camera"].gain).toBe(1.5);

    // A same-revision read cannot erase the unsaved edit or reopen programme.
    await vi.advanceTimersByTimeAsync(2_000);
    expect(writes).toHaveLength(2);
    expect(machine.isSynchronized.value).toBe(false);
    machine.send({ type: "audioMix.source.mute", sourceId: "source-host-camera", muted: true });
    retrySave.resolve(snapshot(2, writes[1].body.state));
    await flush();
    expect(machine.revision.value).toBe(2);
    expect(machine.isSynchronized.value).toBe(false);
    expect(machine.state.value.audioMix["source-host-camera"].muted).toBe(true);

    await vi.advanceTimersByTimeAsync(100);
    expect(writes).toHaveLength(3);
    finalSave.resolve(snapshot(3, writes[2].body.state));
    await flush();
    expect(machine.syncStatus.value).toBe("ready");
    expect(machine.isSynchronized.value).toBe(true);
    firstSave.resolve(snapshot(9, state));
    await flush();
    expect(machine.revision.value).toBe(3);
    expect(machine.state.value.audioMix["source-host-camera"].muted).toBe(true);
  });

  it("keeps a conflict notice visible across a failed poll and same-revision recovery", async () => {
    const original = createInitialStudioState();
    const authoritative = { ...original, status: "Remote programme" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(snapshot(1, original))
      .mockResolvedValueOnce(snapshot(2, authoritative, 409))
      .mockRejectedValueOnce(new Error("temporary network error"))
      .mockResolvedValueOnce(snapshot(2, authoritative));
    vi.stubGlobal("fetch", fetchMock);
    const machine = mountMachine();
    await flush();
    machine.send({ type: "playback.toggle" });
    await vi.advanceTimersByTimeAsync(100);
    const notice = machine.syncConflictNotice.value;
    expect(notice).toContain("Local changes were discarded");
    expect(machine.syncStatus.value).toBe("conflict");

    await vi.advanceTimersByTimeAsync(1_900);
    expect(machine.isSynchronized.value).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(machine.syncStatus.value).toBe("conflict");
    expect(machine.syncConflictNotice.value).toBe(notice);
    expect(machine.isSynchronized.value).toBe(true);
    machine.acknowledgeConflict();
    expect(machine.syncStatus.value).toBe("ready");
  });

  it("bounds the initial request and aborts pending work and timers on unmount", async () => {
    const initial = deferred<Response>();
    const retry = deferred<Response>();
    const fetchMock = vi.fn().mockReturnValueOnce(initial.promise).mockReturnValueOnce(retry.promise);
    vi.stubGlobal("fetch", fetchMock);
    const machine = mountMachine();
    await flush();
    const initialSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;

    await vi.advanceTimersByTimeAsync(8_000);
    expect(initialSignal.aborted).toBe(true);
    expect(machine.syncStatus.value).toBe("error");
    expect(machine.isSynchronized.value).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    const retrySignal = fetchMock.mock.calls[1][1].signal as AbortSignal;

    mountedApps.pop()!.unmount();
    await flush();
    expect(retrySignal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    retry.resolve(snapshot(1, createInitialStudioState()));
    initial.resolve(snapshot(2, createInitialStudioState()));
    await flush();
    expect(machine.revision.value).toBe(0);
    expect(machine.isSynchronized.value).toBe(false);
  });
});
