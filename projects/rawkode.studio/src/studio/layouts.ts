import type { Bounds, CanvasResolution } from "../types";

export function getDynamicGridBounds(count: number, resolution: CanvasResolution): Bounds[] {
  if (count <= 0) {
    return [];
  }

  if (count === 1) {
    return scaleBounds([{ x: 206, y: 116, width: 1508, height: 802 }], resolution);
  }

  if (count === 2) {
    return scaleBounds([
      { x: 168, y: 186, width: 760, height: 620 },
      { x: 992, y: 186, width: 760, height: 620 },
    ], resolution);
  }

  if (count === 3) {
    return scaleBounds([
      { x: 112, y: 192, width: 520, height: 560 },
      { x: 700, y: 192, width: 520, height: 560 },
      { x: 1288, y: 192, width: 520, height: 560 },
    ], resolution);
  }

  const marginX = Math.round(resolution.width * 0.075);
  const marginY = Math.round(resolution.height * 0.119);
  const gap = Math.round(Math.min(resolution.width, resolution.height) * 0.033);
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const cellWidth = Math.floor((resolution.width - marginX * 2 - gap * (columns - 1)) / columns);
  const cellHeight = Math.floor((resolution.height - marginY * 2 - gap * (rows - 1)) / rows);

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    return {
      x: marginX + column * (cellWidth + gap),
      y: marginY + row * (cellHeight + gap),
      width: cellWidth,
      height: cellHeight,
    };
  });
}

export function getScreenshareCameraBounds(count: number, resolution: CanvasResolution): Bounds[] {
  if (count <= 0) {
    return [];
  }

  if (count === 1) {
    return scaleBounds([{ x: 1438, y: 706, width: 360, height: 222 }], resolution);
  }

  if (count === 2) {
    return scaleBounds([
      { x: 1178, y: 748, width: 286, height: 176 },
      { x: 1488, y: 748, width: 286, height: 176 },
    ], resolution);
  }

  const width = Math.round(resolution.width * 0.135);
  const height = Math.round(resolution.height * 0.15);
  const gap = Math.round(resolution.width * 0.0125);
  const totalWidth = width * count + gap * (count - 1);
  const startX = resolution.width - totalWidth - Math.round(resolution.width * 0.065);
  const y = resolution.height - height - Math.round(resolution.height * 0.145);

  return Array.from({ length: count }, (_, index) => ({
    x: startX + index * (width + gap),
    y,
    width,
    height,
  }));
}

export function scaleBounds(bounds: Bounds[], resolution: CanvasResolution): Bounds[] {
  const scaleX = resolution.width / 1920;
  const scaleY = resolution.height / 1080;

  return bounds.map((bound) => ({
    x: Math.round(bound.x * scaleX),
    y: Math.round(bound.y * scaleY),
    width: Math.round(bound.width * scaleX),
    height: Math.round(bound.height * scaleY),
  }));
}
