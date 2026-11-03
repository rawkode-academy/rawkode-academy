import { computed, createRenderer, h, nextTick, ref, ssrContextKey } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioLayer, StudioSource } from "./types";
import { createInitialStudioState } from "./studio/seed";
import { selectOnStageLayers } from "./studio/sourceAdmission";
import { reduceStudioState, type StudioEvent } from "./studio/studioMachine";

const mocks = vi.hoisted(() => ({ machine: undefined as unknown }));
vi.mock("./studio/useStudioMachine", () => ({ useStudioMachine: () => mocks.machine }));
vi.mock("./components/PeopleRail.vue", () => ({ default: {} }));
vi.mock("./components/RealtimeKitRoom.vue", () => ({ default: {} }));
vi.mock("./components/SceneSwitcher.vue", () => ({ default: {} }));
vi.mock("./components/StudioCanvas.vue", () => ({ default: {} }));
vi.mock("./components/StudioWidgets.vue", () => ({ default: {} }));
import App from "./App.vue";

type Node = { children: Node[]; parent?: Node; text?: string };
const renderer = createRenderer<Node, Node>({
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
    node.parent = undefined;
  },
  parentNode: (node) => node.parent ?? null,
  nextSibling: (node) => node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
  patchProp: () => {},
});

afterEach(() => vi.unstubAllGlobals());

describe("App screen output and recovery controls", () => {
  it("keeps an admitted foreign local screen visible and blocks missing media until removed", async () => {
    const foreign: StudioSource = {
      id: "foreign-screen", name: "Other producer's screen", type: "screen", status: "ready",
      settings: { runtimeSource: "local", runtimeOwnerId: "owner-b" },
    };
    const layer: StudioLayer = {
      id: "screen-layer", name: "Screen", type: "screen", sourceId: foreign.id,
      enabled: true, opacity: 1, bounds: { x: 0, y: 0, width: 100, height: 100 },
    };
    let initial = reduceStudioState(createInitialStudioState(), { type: "sources.reconcile", sources: [foreign] });
    initial = reduceStudioState(initial, { type: "source.admission.set", sourceId: foreign.id, admitted: true });
    const shared = ref(initial);
    const selectedLayers = computed(() => selectOnStageLayers([layer], shared.value.onStageSourceIds));
    mocks.machine = {
      state: shared,
      send: (event: StudioEvent) => { shared.value = reduceStudioState(shared.value, event); },
      acknowledgeConflict: () => {},
      hasStagedScene: ref(false), programLayers: selectedLayers, programScene: ref(undefined),
      previewLayers: selectedLayers, previewScene: ref(undefined),
      isSynchronized: ref(true), remoteStateEpoch: ref(0), syncConflictNotice: ref(""), syncError: ref(""), syncStatus: ref("ready"),
    };
    vi.stubGlobal("crypto", { randomUUID: () => "owner-a" });
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", { innerHeight: 900, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
    let latest: Record<string, unknown> = {};
    const component = {
      ...App,
      render(this: { $: { setupState: Record<string, unknown> } }) {
        const setup = this.$.setupState;
        latest = {
          sources: setup.sourcesForUi,
          layers: setup.safeProgramLayers,
          streams: setup.mediaStreams,
          requiredAudio: setup.requiredProgrammeAudioSourceIds,
        };
        return h("div");
      },
    };
    const app = renderer.createApp(component, { sessionId: "session", roomRole: "producer" });
    app.provide(ssrContextKey, { modules: new Set() });
    app.mount({ children: [] });
    await nextTick();

    const visible = (latest.sources as StudioSource[]).find((source) => source.id === foreign.id);
    expect(visible?.settings?.runtimeSource).toBe("unavailable-local");
    expect((latest.layers as StudioLayer[]).map((candidate) => candidate.sourceId)).toContain(foreign.id);
    expect((latest.streams as Map<string, MediaStream>).has(foreign.id)).toBe(false);
    expect(latest.requiredAudio).toContain(foreign.id);

    shared.value = reduceStudioState(shared.value, { type: "source.admission.set", sourceId: foreign.id, admitted: false });
    await nextTick();
    expect((latest.sources as StudioSource[]).some((source) => source.id === foreign.id)).toBe(false);
    expect(latest.layers).toEqual([]);
    expect(latest.requiredAudio).toEqual([]);
    app.unmount();
  });
});
