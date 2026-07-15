import { afterEach, describe, expect, it, vi } from "vitest";
import { captureProgrammeCanvasStream } from "./programmeCanvas";

describe("programme canvas backing store", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps captured programme video at 1920x1080 when devicePixelRatio is 2", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    const canvasState = { height: 150, width: 300 };
    const captureStream = vi.fn((_framesPerSecond: number) => ({
      getVideoTracks: () => [{
        getSettings: () => ({
          height: canvasState.height,
          width: canvasState.width,
        }),
      }],
    }));
    const canvas = {
      get height() {
        return canvasState.height;
      },
      set height(value: number) {
        canvasState.height = value;
      },
      get width() {
        return canvasState.width;
      },
      set width(value: number) {
        canvasState.width = value;
      },
      captureStream,
    };

    const stream = captureProgrammeCanvasStream(canvas as unknown as HTMLCanvasElement, {
      fps: 30,
      height: 1080,
      width: 1920,
    });
    const [videoTrack] = stream.getVideoTracks();

    expect(devicePixelRatio).toBe(2);
    expect({ height: canvas.height, width: canvas.width }).toEqual({
      height: 1080,
      width: 1920,
    });
    expect(videoTrack?.getSettings()).toMatchObject({
      height: 1080,
      width: 1920,
    });
    expect(captureStream).toHaveBeenCalledWith(30);
  });
});
