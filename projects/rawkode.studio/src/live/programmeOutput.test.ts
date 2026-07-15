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

  it("keeps one canonical silent mixer track when the scene has no audio sources", async () => {
    const canvasVideo = track("programme-video", "video");
    const mixedAudio = track("mixed-audio", "audio");
    const context = audioContext(mixedAudio, []);

    const output = await createProgrammeOutput(
      mediaStream([canvasVideo]),
      [],
      {
        createAudioContext: () => context,
        createMediaStream: (tracks) => mediaStream(tracks),
      },
    );

    expect(output.audioSourceCount).toBe(0);
    expect(output.stream.getVideoTracks()).toEqual([canvasVideo]);
    expect(output.stream.getAudioTracks()).toEqual([mixedAudio]);
    expect(output.stream.getAudioTracks()).toHaveLength(1);

    await output.close();
    expect(mixedAudio.stop).toHaveBeenCalledOnce();
  });

  it("updates scene audio sources without replacing the output track", async () => {
    const canvasVideo = track("programme-video", "video");
    const mixedAudio = track("mixed-audio", "audio");
    const firstAudio = track("first-audio", "audio");
    const secondAudio = track("second-audio", "audio");
    const sourceIds: string[] = [];
    const sourceNodes: Array<{
      disconnect: ReturnType<typeof vi.fn>;
      sourceId: string;
    }> = [];
    const context = audioContext(mixedAudio, sourceIds, sourceNodes);
    const output = await createProgrammeOutput(
      mediaStream([canvasVideo]),
      [mediaStream([firstAudio])],
      {
        createAudioContext: () => context,
        createMediaStream: (tracks) => mediaStream(tracks),
      },
    );
    const outputAudioTrack = output.stream.getAudioTracks()[0];

    expect(output.audioSourceCount).toBe(1);
    expect(sourceIds).toEqual(["first-audio"]);

    output.setAudioStreams([mediaStream([secondAudio])]);
    expect(output.audioSourceCount).toBe(1);
    expect(sourceIds).toEqual(["first-audio", "second-audio"]);
    expect(sourceNodes.find((node) => node.sourceId === "first-audio")?.disconnect)
      .toHaveBeenCalledOnce();
    expect(output.stream.getAudioTracks()[0]).toBe(outputAudioTrack);

    output.setAudioStreams([]);
    expect(output.audioSourceCount).toBe(0);
    expect(sourceNodes.find((node) => node.sourceId === "second-audio")?.disconnect)
      .toHaveBeenCalledOnce();
    expect(output.stream.getAudioTracks()[0]).toBe(outputAudioTrack);

    output.setAudioStreams([mediaStream([firstAudio])]);
    expect(output.audioSourceCount).toBe(1);
    expect(sourceIds).toEqual(["first-audio", "second-audio", "first-audio"]);
    expect(output.stream.getAudioTracks()[0]).toBe(outputAudioTrack);

    await output.close();
  });

  it("retains the existing mix when a dynamic source update fails", async () => {
    const canvasVideo = track("programme-video", "video");
    const mixedAudio = track("mixed-audio", "audio");
    const firstAudio = track("first-audio", "audio");
    const failingAudio = track("failing-audio", "audio");
    const sourceNodes: SourceNodeFixture[] = [];
    const context = audioContext(mixedAudio, [], sourceNodes);
    const output = await createProgrammeOutput(
      mediaStream([canvasVideo]),
      [mediaStream([firstAudio])],
      {
        createAudioContext: () => context,
        createMediaStream: (tracks) => mediaStream(tracks),
      },
    );
    context.createMediaStreamSource = () => {
      throw new Error("mixer source failed");
    };

    expect(() => output.setAudioStreams([mediaStream([failingAudio])]))
      .toThrow("mixer source failed");
    expect(output.audioSourceCount).toBe(1);
    expect(sourceNodes.find((node) => node.sourceId === "first-audio")?.disconnect)
      .not.toHaveBeenCalled();
    expect(output.stream.getAudioTracks()).toEqual([mixedAudio]);

    await output.close();
  });

  it("re-syncs late scene audio after a suspended mixer resumes", async () => {
    const canvasVideo = track("programme-video", "video");
    const mixedAudio = track("mixed-audio", "audio");
    const firstAudio = track("first-audio", "audio");
    const secondAudio = track("second-audio", "audio");
    const sourceIds: string[] = [];
    const sourceNodes: SourceNodeFixture[] = [];
    let resumeMixer: (() => void) | undefined;
    const resumePromise = new Promise<void>((resolve) => {
      resumeMixer = resolve;
    });
    const context = audioContext(mixedAudio, sourceIds, sourceNodes);
    context.state = "suspended";
    context.resume = vi.fn(() => resumePromise);
    let currentStreams = [mediaStream([firstAudio])];

    const creatingOutput = createProgrammeOutput(
      mediaStream([canvasVideo]),
      () => currentStreams,
      {
        createAudioContext: () => context,
        createMediaStream: (tracks) => mediaStream(tracks),
      },
    );
    expect(context.resume).toHaveBeenCalledOnce();
    currentStreams = [mediaStream([secondAudio])];
    resumeMixer?.();

    const output = await creatingOutput;
    expect(sourceIds).toEqual(["first-audio", "second-audio"]);
    expect(sourceNodes.find((node) => node.sourceId === "first-audio")?.disconnect)
      .toHaveBeenCalledOnce();
    expect(output.audioSourceCount).toBe(1);
    expect(output.stream.getAudioTracks()).toEqual([mixedAudio]);

    await output.close();
  });

  it("cleans up when the post-resume audio re-sync fails", async () => {
    const canvasVideo = track("programme-video", "video");
    const mixedAudio = track("mixed-audio", "audio");
    const firstAudio = track("first-audio", "audio");
    const failingAudio = track("failing-audio", "audio");
    let resumeMixer: (() => void) | undefined;
    const resumePromise = new Promise<void>((resolve) => {
      resumeMixer = resolve;
    });
    const context = audioContext(mixedAudio, []);
    const createMediaStreamSource = context.createMediaStreamSource.bind(context);
    context.state = "suspended";
    context.resume = vi.fn(() => resumePromise);
    context.createMediaStreamSource = (stream) => {
      if (stream.getAudioTracks()[0]?.id === "failing-audio") {
        throw new Error("mixer source failed");
      }
      return createMediaStreamSource(stream);
    };
    let currentStreams = [mediaStream([firstAudio])];

    const creatingOutput = createProgrammeOutput(
      mediaStream([canvasVideo]),
      () => currentStreams,
      {
        createAudioContext: () => context,
        createMediaStream: (tracks) => mediaStream(tracks),
      },
    );
    currentStreams = [mediaStream([failingAudio])];
    resumeMixer?.();

    await expect(creatingOutput).rejects.toThrow("mixer source failed");
    expect(canvasVideo.stop).toHaveBeenCalledOnce();
    expect(mixedAudio.stop).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it("rejects a programme canvas without a live video track", async () => {
    const createAudioContext = vi.fn();

    await expect(createProgrammeOutput(
      mediaStream([]),
      [],
      {
        createAudioContext,
        createMediaStream: (tracks) => mediaStream(tracks),
      },
    )).rejects.toThrow("Programme canvas has no live video track.");
    expect(createAudioContext).not.toHaveBeenCalled();
  });

  it.each([0, 2])(
    "rejects a mixer destination with %i audio tracks",
    async (trackCount) => {
      const canvasVideo = track("programme-video", "video");
      const mixedTracks = Array.from(
        { length: trackCount },
        (_, index) => track(`mixed-${index}`, "audio"),
      );
      const context = audioContext(mixedTracks, []);

      await expect(createProgrammeOutput(
        mediaStream([canvasVideo]),
        [],
        {
          createAudioContext: () => context,
          createMediaStream: (tracks) => mediaStream(tracks),
        },
      )).rejects.toThrow(
        "Programme audio mixer did not produce exactly one audio track.",
      );
      expect(canvasVideo.stop).toHaveBeenCalledOnce();
    },
  );
});

interface SourceNodeFixture {
  disconnect: ReturnType<typeof vi.fn>;
  sourceId: string;
}

function audioContext(
  mixedTrack: MediaStreamTrack | MediaStreamTrack[],
  sourceIds: string[],
  sourceNodes: SourceNodeFixture[] = [],
): ProgrammeAudioContext {
  const mixedTracks = Array.isArray(mixedTrack) ? mixedTrack : [mixedTrack];
  return {
    state: "running",
    close: vi.fn(async () => undefined),
    createMediaStreamDestination: () => ({
      disconnect: vi.fn(),
      stream: mediaStream(mixedTracks),
    }),
    createMediaStreamSource: (stream) => {
      const sourceId = stream.getAudioTracks()[0]?.id ?? "";
      const node = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        sourceId,
      };
      sourceIds.push(sourceId);
      sourceNodes.push(node);
      return node;
    },
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
