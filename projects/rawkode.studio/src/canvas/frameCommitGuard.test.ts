import { describe, expect, it, vi } from "vitest";
import { createFrameCommitGuard } from "./frameCommitGuard";

describe("programme frame admission fence", () => {
  it("discards an in-flight frame after admission changes, then commits the current frame", async () => {
    const guard = createFrameCommitGuard();
    let finishOverlay!: () => void;
    const overlayLoaded = new Promise<void>((resolve) => { finishOverlay = resolve; });
    const publishOldFrame = vi.fn();
    const pending = guard.render(() => overlayLoaded, publishOldFrame);
    guard.invalidate(); // Producer removes a guest while HTML overlay decoding waits.
    finishOverlay();
    expect(await pending).toBe(false);
    expect(publishOldFrame).not.toHaveBeenCalled();
    const publishCurrentFrame = vi.fn();
    expect(await guard.render(async () => {}, publishCurrentFrame)).toBe(true);
    expect(publishCurrentFrame).toHaveBeenCalledOnce();
  });

  it("never publishes a failed render", async () => {
    const guard = createFrameCommitGuard();
    const publish = vi.fn();
    await expect(guard.render(async () => { throw new Error("Overlay failed"); }, publish)).rejects.toThrow("Overlay failed");
    expect(publish).not.toHaveBeenCalled();
  });
});
