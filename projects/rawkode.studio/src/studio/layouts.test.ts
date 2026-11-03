import { describe, expect, it } from "vitest";
import type { Bounds, CanvasResolution } from "../types";
import { getDynamicGridBounds, getScreenshareCameraBounds, scaleBounds } from "./layouts";

const HD: CanvasResolution = { width: 1920, height: 1080, fps: 30 };
const SUPPORTED_RESOLUTIONS: CanvasResolution[] = [
  HD,
  { width: 3840, height: 2160, fps: 60 },
  { width: 2560, height: 1080, fps: 30 },
  { width: 1280, height: 720, fps: 30 },
  { width: 1024, height: 768, fps: 30 },
  { width: 720, height: 1280, fps: 30 },
  { width: 640, height: 360, fps: 30 },
  { width: 320, height: 180, fps: 30 },
];

describe("studio layouts", () => {
  it("preserves the production dynamic-grid presets", () => {
    expect(getDynamicGridBounds(1, HD)).toEqual([{ x: 206, y: 116, width: 1508, height: 802 }]);
    expect(getDynamicGridBounds(2, HD)).toEqual([
      { x: 168, y: 186, width: 760, height: 620 },
      { x: 992, y: 186, width: 760, height: 620 },
    ]);
    expect(getDynamicGridBounds(3, HD)).toEqual([
      { x: 112, y: 192, width: 520, height: 560 },
      { x: 700, y: 192, width: 520, height: 560 },
      { x: 1288, y: 192, width: 520, height: 560 },
    ]);
    expect(getDynamicGridBounds(4, HD)).toEqual([
      { x: 144, y: 129, width: 798, height: 393 },
      { x: 978, y: 129, width: 798, height: 393 },
      { x: 144, y: 558, width: 798, height: 393 },
      { x: 978, y: 558, width: 798, height: 393 },
    ]);
  });

  it("preserves the production screenshare presets for one to three cameras", () => {
    expect(getScreenshareCameraBounds(1, HD)).toEqual([{ x: 1438, y: 706, width: 360, height: 222 }]);
    expect(getScreenshareCameraBounds(2, HD)).toEqual([
      { x: 1178, y: 748, width: 286, height: 176 },
      { x: 1488, y: 748, width: 286, height: 176 },
    ]);
    expect(getScreenshareCameraBounds(3, HD)).toEqual([
      { x: 970, y: 761, width: 259, height: 162 },
      { x: 1253, y: 761, width: 259, height: 162 },
      { x: 1536, y: 761, width: 259, height: 162 },
    ]);
  });

  it("keeps counts one through twelve inside every supported canvas", () => {
    for (const resolution of SUPPORTED_RESOLUTIONS) {
      for (let count = 1; count <= 12; count += 1) {
        assertValidLayout(getDynamicGridBounds(count, resolution), count, resolution);
        assertValidLayout(getScreenshareCameraBounds(count, resolution), count, resolution);
      }
    }
  });

  it("wraps larger screenshare groups into bottom-right rows", () => {
    const bounds = getScreenshareCameraBounds(12, HD);
    const rows = new Map<number, Bounds[]>();
    for (const bound of bounds) {
      rows.set(bound.y, [...(rows.get(bound.y) ?? []), bound]);
    }

    expect([...rows.values()].map((row) => row.length)).toEqual([4, 4, 4]);
    expect([...rows.keys()]).toEqual([405, 583, 761]);
    expect(bounds.filter((bound) => bound.x + bound.width === 1795)).toHaveLength(3);
  });

  it("returns no layout for unsupported counts or canvas dimensions", () => {
    expect(getDynamicGridBounds(0, HD)).toEqual([]);
    expect(getScreenshareCameraBounds(Number.NaN, HD)).toEqual([]);
    expect(getDynamicGridBounds(3, { width: 0, height: 1080, fps: 30 })).toEqual([]);
    expect(getScreenshareCameraBounds(3, { width: 1920, height: Number.POSITIVE_INFINITY, fps: 30 })).toEqual([]);
  });

  it("clamps scaled bounds to the target canvas", () => {
    expect(scaleBounds([{ x: -20, y: 90, width: 8000, height: 8000 }], {
      width: 640,
      height: 360,
      fps: 30,
    })).toEqual([{ x: 0, y: 30, width: 640, height: 330 }]);
  });
});

function assertValidLayout(bounds: Bounds[], count: number, resolution: CanvasResolution): void {
  expect(bounds, `${resolution.width}x${resolution.height} count ${count}`).toHaveLength(count);

  for (const bound of bounds) {
    expect(Object.values(bound).every(Number.isFinite)).toBe(true);
    expect(Number.isInteger(bound.x)).toBe(true);
    expect(Number.isInteger(bound.y)).toBe(true);
    expect(Number.isInteger(bound.width)).toBe(true);
    expect(Number.isInteger(bound.height)).toBe(true);
    expect(bound.x).toBeGreaterThanOrEqual(0);
    expect(bound.y).toBeGreaterThanOrEqual(0);
    expect(bound.width).toBeGreaterThan(0);
    expect(bound.height).toBeGreaterThan(0);
    expect(bound.x + bound.width).toBeLessThanOrEqual(resolution.width);
    expect(bound.y + bound.height).toBeLessThanOrEqual(resolution.height);
  }

  for (let leftIndex = 0; leftIndex < bounds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < bounds.length; rightIndex += 1) {
      expect(overlaps(bounds[leftIndex], bounds[rightIndex])).toBe(false);
    }
  }
}

function overlaps(left: Bounds, right: Bounds): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}
