import { describe, expect, it, vi } from "vitest";
import {
  collectUniqueAudibleAudioTracks,
  createProgrammeOutput,
  type ProgrammeAudioContext,
} from "./programmeOutput";

describe("programme output", () => {
  it("deduplicates audible source tracks and produces exactly one mixed audio track", async () => {
    const duplicateAudio = track("same-audio", "audio");
    const secondAudio = track("second-audio", "audio");
    const canvasVideo = track("programme-video", "video");
    const mixedAudio = track("mixed-audio", "audio");
    const canvasStream = mediaStream([canvasVideo]);
    const inputStreams = [
      mediaStream([duplicateAudio]),
      mediaStream([duplicateAudio, secondAudio]),
    ];
    const sourceIds: string[] = [];
    const context = audioContext(mixedAudio, sourceIds);

    expect(collectUniqueAudibleAudioTracks(inputStreams)).toEqual([
      duplicateAudio,
      secondAudio,
    ]);

    const output = await createProgrammeOutput(canvasStream, inputStreams, {
      createAudioContext: () => context,
      createMediaStream: (tracks) => mediaStream(tracks),
    });

    expect(output.audioSourceCount).toBe(2);
    expect(output.stream.getVideoTracks()).toEqual([canvasVideo]);
    expect(output.stream.getAudioTracks()).toEqual([mixedAudio]);
    expect(output.stream.getAudioTracks()).toHaveLength(1);
    expect(sourceIds).toEqual(["same-audio", "second-audio"]);
    expect(duplicateAudio.stop).not.toHaveBeenCalled();
    expect(secondAudio.stop).not.toHaveBeenCalled();

    await output.close();

    expect(canvasVideo.stop).toHaveBeenCalledOnce();
    expect(mixedAudio.stop).toHaveBeenCalledOnce();
    expect(duplicateAudio.stop).not.toHaveBeenCalled();
    expect(secondAudio.stop).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it("rejects silent output instead of publishing a placeholder audio track", async () => {
    const canvasVideo = track("programme-video", "video");

    await expect(createProgrammeOutput(
      mediaStream([canvasVideo]),
      [mediaStream([])],
      { createMediaStream: (tracks) => mediaStream(tracks) },
    )).rejects.toThrow("Programme has no audible audio source.");
    expect(canvasVideo.stop).toHaveBeenCalledOnce();
  });
});

function audioContext(
  mixedTrack: MediaStreamTrack,
  sourceIds: string[],
): ProgrammeAudioContext {
  return {
    state: "running",
    close: vi.fn(async () => undefined),
    createMediaStreamDestination: () => ({
      disconnect: vi.fn(),
      stream: mediaStream([mixedTrack]),
    }),
    createMediaStreamSource: (stream) => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      stream,
      sourceId: sourceIds.push(stream.getAudioTracks()[0]?.id ?? ""),
    }),
  };
}

function mediaStream(tracks: MediaStreamTrack[]): MediaStream {
  return {
    getAudioTracks: () => tracks.filter((track) => track.kind === "audio"),
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((track) => track.kind === "video"),
  } as MediaStream;
}

function track(id: string, kind: MediaStreamTrack["kind"]): MediaStreamTrack {
  return {
    enabled: true,
    id,
    kind,
    muted: false,
    readyState: "live",
    stop: vi.fn(),
  } as unknown as MediaStreamTrack;
}
