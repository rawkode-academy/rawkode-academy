import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgrammeMonitor } from "./programmeMonitor";

class FakeTrack {
  readonly stop = vi.fn();

  constructor(readonly id: string) {}
}

class FakeStream {
  clonedStream?: FakeStream;

  constructor(readonly tracks: FakeTrack[]) {}

  clone(): FakeStream {
    this.clonedStream = new FakeStream(this.tracks.map((track) => new FakeTrack(`${track.id}-clone`)));
    return this.clonedStream;
  }

  getTracks(): FakeTrack[] {
    return this.tracks;
  }
}

class FakeElement {
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  className = "";
  hidden = false;
  onclick: (() => void) | null = null;
  textContent = "";

  constructor(readonly tagName: string) {}

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

class FakeVideoElement extends FakeElement {
  autoplay = false;
  muted = false;
  playsInline = false;
  srcObject: FakeStream | null = null;
  readonly pause = vi.fn();
  readonly play = vi.fn<() => Promise<void>>(() => Promise.resolve());
  readonly captureStream = vi.fn();

  constructor() {
    super("video");
  }
}

class FakeDocument {
  readonly body = new FakeElement("body") as FakeElement & {
    replaceChildren: (...children: FakeElement[]) => void;
  };
  readonly documentElement = new FakeElement("html") as FakeElement & {
    requestFullscreen?: () => Promise<void>;
  };
  readonly head = new FakeElement("head");
  readonly created: FakeElement[] = [];
  title = "";

  constructor() {
    this.body.replaceChildren = (...children: FakeElement[]) => {
      this.body.children.splice(0, this.body.children.length, ...children);
    };
    this.documentElement.requestFullscreen = vi.fn(() => Promise.resolve());
  }

  createElement(tagName: string): FakeElement {
    const element = tagName === "video" ? new FakeVideoElement() : new FakeElement(tagName);
    this.created.push(element);
    return element;
  }

  first<T extends FakeElement>(tagName: string): T {
    const element = this.created.find((candidate) => candidate.tagName === tagName);
    if (!element) throw new Error(`Missing fake ${tagName} element`);
    return element as T;
  }

  buttons(): FakeElement[] {
    return this.created.filter((candidate) => candidate.tagName === "button");
  }
}

type FakeEvent = { altKey?: boolean; ctrlKey?: boolean; key?: string; metaKey?: boolean };

class FakePopup {
  readonly document = new FakeDocument();
  readonly focus = vi.fn();
  closed = false;
  private readonly listeners = new Map<string, Set<(event: FakeEvent) => void>>();
  readonly close = vi.fn(() => {
    this.closed = true;
  });

  addEventListener(type: string, listener: (event: FakeEvent) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: FakeEvent) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: FakeEvent = {}): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

function asWindow(popup: FakePopup): Window {
  return popup as unknown as Window;
}

function asMediaStream(stream: FakeStream): MediaStream {
  return stream as unknown as MediaStream;
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("programme monitor ownership lifecycle", () => {
  it("stops only cloned output tracks when the monitor closes", async () => {
    vi.useFakeTimers();
    const popup = new FakePopup();
    const inputTracks = [new FakeTrack("camera"), new FakeTrack("programme-audio")];
    const input = new FakeStream(inputTracks);
    const pending = createProgrammeMonitor(asWindow(popup));
    const monitor = await pending.attach(asMediaStream(input));
    const video = popup.document.first<FakeVideoElement>("video");

    expect(video.srcObject).toBe(input.clonedStream);
    expect(input.clonedStream).toBeDefined();
    expect(inputTracks.every((track) => track.stop.mock.calls.length === 0)).toBe(true);
    expect(monitor.isOpen()).toBe(true);

    monitor.focus();
    expect(popup.focus).toHaveBeenCalledOnce();
    monitor.close();

    expect(input.clonedStream?.tracks.every((track) => track.stop.mock.calls.length === 1)).toBe(true);
    expect(inputTracks.every((track) => track.stop.mock.calls.length === 0)).toBe(true);
    expect(video.pause).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
    expect(popup.close).toHaveBeenCalledOnce();
    expect(popup.listenerCount("keydown")).toBe(0);
    expect(popup.listenerCount("pagehide")).toBe(0);
    expect(monitor.isOpen()).toBe(false);

    monitor.close();
    expect(input.clonedStream?.tracks.every((track) => track.stop.mock.calls.length === 1)).toBe(true);
  });

  it("cleans up clones and the popup when autoplay fails", async () => {
    const popup = new FakePopup();
    const pending = createProgrammeMonitor(asWindow(popup));
    const video = popup.document.first<FakeVideoElement>("video");
    video.play.mockRejectedValueOnce(new Error("blocked"));
    const inputTrack = new FakeTrack("camera");
    const input = new FakeStream([inputTrack]);

    await expect(
      pending.attach(asMediaStream(input)),
    ).rejects.toThrow("The programme output could not play");

    expect(input.clonedStream?.tracks[0]?.stop).toHaveBeenCalledOnce();
    expect(inputTrack.stop).not.toHaveBeenCalled();
    expect(video.pause).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
    expect(popup.close).toHaveBeenCalledOnce();
  });

  it("does not publish a late attach after the popup closes", async () => {
    const popup = new FakePopup();
    const pending = createProgrammeMonitor(asWindow(popup));
    const video = popup.document.first<FakeVideoElement>("video");
    const play = deferred();
    video.play.mockReturnValueOnce(play.promise);
    const inputTrack = new FakeTrack("programme-audio");
    const input = new FakeStream([inputTrack]);
    const attaching = pending.attach(asMediaStream(input));

    pending.close();
    expect(input.clonedStream?.tracks[0]?.stop).toHaveBeenCalledOnce();
    expect(inputTrack.stop).not.toHaveBeenCalled();
    play.resolve();

    await expect(attaching).rejects.toThrow("The programme output window was closed");
    expect(input.clonedStream?.tracks[0]?.stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });

  it("keeps audio muted until the operator clicks and keeps controls outside the media stream", async () => {
    vi.useFakeTimers();
    const popup = new FakePopup();
    const pending = createProgrammeMonitor(asWindow(popup));
    const video = popup.document.first<FakeVideoElement>("video");
    const inputTrack = new FakeTrack("camera");
    const input = new FakeStream([inputTrack]);
    const monitor = await pending.attach(asMediaStream(input));
    const controls = popup.document.first<FakeElement>("section");
    const buttons = popup.document.buttons();
    const audioButton = buttons.find((button) => button.textContent === "Enable programme audio")!;
    const fullscreenButton = buttons.find((button) => button.textContent === "Fullscreen")!;
    const hideButton = buttons.find((button) => button.textContent === "Hide controls")!;

    expect(video.muted).toBe(true);
    expect(audioButton.attributes.get("aria-pressed")).toBe("false");
    expect(video.srcObject).toBe(input.clonedStream);
    expect(video.children).not.toContain(controls);
    expect(popup.document.body.children).toEqual([video, controls]);
    expect(video.captureStream).not.toHaveBeenCalled();

    audioButton.onclick?.();
    expect(video.muted).toBe(false);
    expect(audioButton.attributes.get("aria-pressed")).toBe("true");
    expect(video.play).toHaveBeenCalledTimes(2);

    hideButton.onclick?.();
    expect(controls.hidden).toBe(true);
    popup.dispatch("keydown", { key: "c" });
    expect(controls.hidden).toBe(false);
    expect(fullscreenButton.textContent).toBe("Fullscreen");

    monitor.close();
    expect(inputTrack.stop).not.toHaveBeenCalled();
  });
});
