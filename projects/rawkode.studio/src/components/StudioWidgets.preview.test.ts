import * as Vue from "vue";
import { createRenderer, h, markRaw, nextTick, shallowReactive, ssrContextKey } from "vue";
import { compileScript, compileTemplate, parse } from "vue/compiler-sfc";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { StudioSource } from "../types";
import MediaStreamPreview from "./MediaStreamPreview.vue";
import StudioWidgets from "./StudioWidgets.vue";

// Vitest imports these components in SSR mode. Compile their real templates
// for the custom renderer so the button and video events are exercised.
function clientComponent(component: any, filename: string, replacements: Record<string, unknown> = {}): any {
  const descriptor = parse(readFileSync(new URL(filename, import.meta.url), "utf8"), { filename }).descriptor;
  const script = compileScript(descriptor, { id: filename });
  const template = compileTemplate({ source: descriptor.template!.content, filename, id: filename,
    compilerOptions: { mode: "function", bindingMetadata: script.bindings } });
  if (template.errors.length) throw new Error(String(template.errors[0]));
  const render = new Function("Vue", template.code)(Vue);
  return {
    ...component,
    render,
    setup(props: unknown, context: unknown) {
      const result = component.setup(props, context);
      return new Proxy(result, { get: (target, key) =>
        typeof key === "string" && key in replacements ? replacements[key] : Reflect.get(target, key) });
    },
  };
}

const previewComponent = clientComponent(MediaStreamPreview, "./MediaStreamPreview.vue");
const widgetsComponent = clientComponent(StudioWidgets, "./StudioWidgets.vue", { MediaStreamPreview: previewComponent });

type Node = {
  tag?: string;
  text?: string;
  parent?: Node;
  children: Node[];
  props: Record<string, unknown>;
  srcObject: MediaStream | null;
  readyState: number;
  videoWidth: number;
  videoHeight: number;
  play: () => Promise<void>;
  pause: () => void;
};

function node(tag?: string, text?: string): Node {
  return markRaw({ tag, text, children: [], props: {}, srcObject: null, readyState: 0, videoWidth: 0, videoHeight: 0,
    play: async () => {}, pause: () => {} });
}

const renderer = createRenderer<Node, Node>({
  createElement: (tag) => node(tag),
  createText: (text) => node(undefined, text),
  createComment: (text) => node(undefined, text),
  setText: (element, text) => { element.text = text; },
  setElementText: (element, text) => { element.text = text; },
  insert: (element, parent, anchor) => {
    if (element.parent) {
      const previous = element.parent.children.indexOf(element);
      if (previous >= 0) element.parent.children.splice(previous, 1);
    }
    element.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, element);
  },
  remove: (element) => {
    const siblings = element.parent?.children;
    if (siblings) siblings.splice(siblings.indexOf(element), 1);
    element.parent = undefined;
  },
  parentNode: (element) => element.parent ?? null,
  nextSibling: (element) => element.parent?.children[element.parent.children.indexOf(element) + 1] ?? null,
  patchProp: (element, key, _previous, next) => { element.props[key] = next; },
});

function find(root: Node, predicate: (candidate: Node) => boolean): Node | undefined {
  if (predicate(root)) return root;
  for (const child of root.children) {
    const match = find(child, predicate);
    if (match) return match;
  }
  return undefined;
}

function fire(target: Node, event: string): void {
  const handler = target.props[event];
  if (typeof handler !== "function") throw new Error(`No handler for ${event}`);
  handler({ currentTarget: target });
}

describe("guest screen preview admission", () => {
  it("requires a decoded current preview, ignores a replaced stream, and permits removal without media", async () => {
    const source: StudioSource = {
      id: "source-realtimekit-screen-v3.guest", name: "Guest screen", type: "screen", status: "ready",
      settings: { runtimeSource: "realtimekit", realtimeKitSource: "screen", captureStatus: "ready" },
    };
    const firstTrack = { kind: "video", readyState: "live", enabled: true, muted: false } as MediaStreamTrack;
    const secondTrack = { kind: "video", readyState: "live", enabled: true, muted: false } as MediaStreamTrack;
    let firstTracks = [firstTrack];
    const first = { getVideoTracks: () => firstTracks, getAudioTracks: () => [] } as unknown as MediaStream;
    const second = { getVideoTracks: () => [secondTrack], getAudioTracks: () => [] } as unknown as MediaStream;
    const state = shallowReactive<{ stream?: MediaStream; onStage: boolean; canAdmit: boolean }>({ stream: first, onStage: false, canAdmit: true });
    const onAdmission = vi.fn();
    const app = renderer.createApp({
      render: () => h(widgetsComponent, {
        sources: [source],
        mediaStreams: state.stream ? new Map([[source.id, state.stream]]) : new Map(),
        activeScreenShareSourceId: "",
        canAdmit: state.canAdmit,
        localOwnerId: "producer",
        onStageSourceIds: state.onStage ? [source.id] : [],
        onSourceAdmissionChange: onAdmission,
      }),
    });
    const root = node("root");
    app.provide(ssrContextKey, { modules: new Set() });
    app.mount(root);
    await nextTick();
    const button = () => find(root, (element) => element.props["aria-label"] === "Add Guest screen to stage")!;
    const firstVideo = find(root, (element) => element.tag === "video")!;
    expect(firstVideo.srcObject).toBe(first);
    expect(button().props.disabled).toBe(true);
    firstVideo.readyState = 2;
    fire(firstVideo, "onLoadeddata");
    await nextTick();
    expect(button().props.disabled).toBe(true);
    firstVideo.videoWidth = 1280;
    firstVideo.videoHeight = 720;
    fire(firstVideo, "onPlaying");
    await nextTick();
    expect(button().props.disabled).toBe(false);
    state.canAdmit = false;
    await nextTick();
    expect(button().props.disabled).toBe(true);
    fire(button(), "onClick");
    expect(onAdmission).not.toHaveBeenCalled();
    state.canAdmit = true;
    await nextTick();
    fire(button(), "onClick");
    expect(onAdmission).toHaveBeenLastCalledWith(source.id, true, first, firstTrack);
    onAdmission.mockClear();
    Object.assign(firstTrack, { muted: true });
    fire(button(), "onClick");
    expect(onAdmission).not.toHaveBeenCalled();
    Object.assign(firstTrack, { muted: false });
    firstTracks = [secondTrack];
    fire(firstVideo, "onPlaying");
    await nextTick();
    fire(button(), "onClick");
    expect(onAdmission).not.toHaveBeenCalled();
    firstTracks = [firstTrack];

    state.stream = second;
    await nextTick();
    const secondVideo = find(root, (element) => element.tag === "video")!;
    expect(secondVideo).not.toBe(firstVideo);
    expect(secondVideo.srcObject).toBe(second);
    expect(button().props.disabled).toBe(true);
    fire(firstVideo, "onLoadeddata");
    await nextTick();
    expect(button().props.disabled).toBe(true);
    secondVideo.readyState = 2;
    secondVideo.videoWidth = 640;
    secondVideo.videoHeight = 360;
    fire(secondVideo, "onLoadeddata");
    await nextTick();
    expect(button().props.disabled).toBe(false);
    fire(button(), "onClick");
    expect(onAdmission).toHaveBeenLastCalledWith(source.id, true, second, secondTrack);

    state.onStage = true;
    state.stream = undefined;
    await nextTick();
    const remove = find(root, (element) => element.props["aria-label"] === "Remove Guest screen from stage")!;
    expect(remove.props.disabled).toBe(false);
    fire(remove, "onClick");
    expect(onAdmission).toHaveBeenLastCalledWith(source.id, false, undefined, undefined);
    app.unmount();
  });
});
