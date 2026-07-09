import { describe, expect, it } from "vitest";
import type { StudioSource } from "../types";
import { selectProgrammeAudioStreams } from "./programmeAudioSources";

function source(id: string, type: StudioSource["type"]): StudioSource {
  return { id, name: id, status: "ready", type };
}

describe("selectProgrammeAudioStreams", () => {
  it("includes every camera and only the selected screen share", () => {
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

    expect([...selectProgrammeAudioStreams(streams, sources, "screen-b").keys()]).toEqual([
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
    ).size).toBe(0);
  });
});
