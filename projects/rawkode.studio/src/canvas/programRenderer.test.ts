import { describe, expect, it, vi } from "vitest";
import { renderProgramCanvas } from "./programRenderer";

describe("renderProgramCanvas", () => {
  it("keeps operator PROGRAM, REC, and safe-area chrome out of programme pixels", async () => {
    const calls = {
      fillText: vi.fn(),
      quadraticCurveTo: vi.fn(),
    };
    const gradient = { addColorStop: vi.fn() };
    const context = new Proxy(calls as unknown as CanvasRenderingContext2D, {
      get(target, property, receiver) {
        const existing = Reflect.get(target, property, receiver) as unknown;
        if (existing) {
          return existing;
        }
        if (property === "createLinearGradient" || property === "createRadialGradient") {
          return () => gradient;
        }
        return vi.fn();
      },
    });

    await renderProgramCanvas(context, {
      layers: [],
      resolution: { width: 320, height: 180, fps: 30 },
      timestamp: 0,
    });

    expect(calls.fillText).not.toHaveBeenCalledWith("PROGRAM", expect.anything(), expect.anything());
    expect(calls.fillText).not.toHaveBeenCalledWith("REC", expect.anything(), expect.anything());
    expect(calls.quadraticCurveTo).not.toHaveBeenCalled();
  });
});
