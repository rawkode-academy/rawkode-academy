import { describe, expect, it } from "vitest";
import type { StudioSource } from "../types";
import { selectProgrammeAudioStreams } from "./programmeAudioSources";

function source(id: string, type: StudioSource["type"]): StudioSource {
  return { id, name: id, status: "ready", type };
}

describe("selectProgrammeAudioStreams", () => {
  it("includes admitted cameras and only the admitted selected screen share", () => {
    const streams = new Map<string, MediaStream>([
      ["camera-a", {} as MediaStream],
      ["camera-b", {} as MediaStream],
      ["screen-a", {} as MediaStream],
      ["screen-b", {} as MediaStream],
      ["video", {} as MediaStream],
    ]);
    const sources = [
      source("camera-a", "camera"),
      source("camera-b", "camera"),
      source("screen-a", "screen"),
      source("screen-b", "screen"),
      source("video", "video"),
    ];

    expect([...selectProgrammeAudioStreams(streams, sources, "screen-b", ["camera-a", "camera-b", "screen-a", "screen-b"]).keys()]).toEqual([
      "camera-a",
      "camera-b",
      "screen-b",
    ]);
  });

  it("does not mix an unknown stale screen selection", () => {
    const streams = new Map<string, MediaStream>([["screen-a", {} as MediaStream]]);

    expect(selectProgrammeAudioStreams(
      streams,
      [source("screen-a", "screen")],
      "missing-screen",
      ["screen-a"],
    ).size).toBe(0);
  });

  it("keeps backstage camera audio and selected screen audio out of the mix", () => {
    const streams = new Map<string, MediaStream>([
      ["host", {} as MediaStream],
      ["guest", {} as MediaStream],
      ["screen", {} as MediaStream],
    ]);
    const sources = [source("host", "camera"), source("guest", "camera"), source("screen", "screen")];

    expect([...selectProgrammeAudioStreams(streams, sources, "screen", ["host"]).keys()]).toEqual(["host"]);
    expect(selectProgrammeAudioStreams(streams, sources, "screen", []).size).toBe(0);
    expect(selectProgrammeAudioStreams(streams, sources, "screen", undefined as unknown as string[]).size).toBe(0);
  });

  it("does not admit a screen when only its contributor camera was admitted", () => {
    const streams = new Map<string, MediaStream>([["screen", {} as MediaStream]]);
    expect(selectProgrammeAudioStreams(streams, [source("screen", "screen")], "screen", ["camera"]).size).toBe(0);
  });
});
