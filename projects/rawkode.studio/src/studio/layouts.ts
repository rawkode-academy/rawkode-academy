import type { Bounds, CanvasResolution } from "../types";

interface CanvasSize {
  height: number;
  width: number;
}

const SCREENSHARE_THUMBNAIL_RATIO = 259 / 162;

export function getDynamicGridBounds(count: number, resolution: CanvasResolution): Bounds[] {
  const participantCount = normalizeCount(count);
  if (participantCount === 0 || !getCanvasSize(resolution)) {
    return [];
  }

  if (participantCount === 1) {
    return scaleBounds([{ x: 206, y: 116, width: 1508, height: 802 }], resolution);
  }

  if (participantCount === 2) {
    return scaleBounds([
      { x: 168, y: 186, width: 760, height: 620 },
      { x: 992, y: 186, width: 760, height: 620 },
    ], resolution);
  }

  if (participantCount === 3) {
    return scaleBounds([
      { x: 112, y: 192, width: 520, height: 560 },
      { x: 700, y: 192, width: 520, height: 560 },
      { x: 1288, y: 192, width: 520, height: 560 },
    ], resolution);
  }

  const canvas = getCanvasSize(resolution);
  if (!canvas) {
    return [];
  }

  const columns = Math.ceil(Math.sqrt(participantCount));
  const rows = Math.ceil(participantCount / columns);
  return createCenteredGrid(participantCount, columns, rows, canvas, {
    gapX: Math.round(Math.min(canvas.width, canvas.height) * 0.033),
    gapY: Math.round(Math.min(canvas.width, canvas.height) * 0.033),
    marginX: Math.round(canvas.width * 0.075),
    marginY: Math.round(canvas.height * 0.119),
  });
}

export function getScreenshareCameraBounds(count: number, resolution: CanvasResolution): Bounds[] {
  const participantCount = normalizeCount(count);
  const canvas = getCanvasSize(resolution);
  if (participantCount === 0 || !canvas) {
    return [];
  }

  if (participantCount === 1) {
    return scaleBounds([{ x: 1438, y: 706, width: 360, height: 222 }], resolution);
  }

  if (participantCount === 2) {
    return scaleBounds([
      { x: 1178, y: 748, width: 286, height: 176 },
      { x: 1488, y: 748, width: 286, height: 176 },
    ], resolution);
  }

  const columns = Math.min(4, participantCount);
  const rows = Math.ceil(participantCount / columns);
  const marginX = clampMargin(Math.round(canvas.width * 0.065), canvas.width, columns);
  const marginY = clampMargin(Math.round(canvas.height * 0.145), canvas.height, rows);
  const availableWidth = canvas.width - marginX * 2;
  const availableHeight = canvas.height - marginY * 2;
  const gapX = getSafeGap(Math.round(canvas.width * 0.0125), availableWidth, columns);
  const gapY = getSafeGap(Math.round(canvas.height * 0.015), availableHeight, rows);
  const desiredWidth = Math.max(
    1,
    Math.min(
      Math.round(canvas.width * 0.135),
      Math.round(canvas.height * 0.15 * SCREENSHARE_THUMBNAIL_RATIO),
    ),
  );
  const desiredHeight = Math.max(1, Math.round(desiredWidth / SCREENSHARE_THUMBNAIL_RATIO));
  const scale = Math.min(
    1,
    (availableWidth - gapX * (columns - 1)) / (desiredWidth * columns),
    (availableHeight - gapY * (rows - 1)) / (desiredHeight * rows),
  );
  const width = Math.max(1, Math.floor(desiredWidth * scale));
  const height = Math.max(1, Math.floor(desiredHeight * scale));
  const gridWidth = width * columns + gapX * (columns - 1);
  const gridHeight = height * rows + gapY * (rows - 1);
  const startX = canvas.width - marginX - gridWidth;
  const startY = canvas.height - marginY - gridHeight;

  return Array.from({ length: participantCount }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const itemsInRow = Math.min(columns, participantCount - row * columns);
    const rowWidth = width * itemsInRow + gapX * (itemsInRow - 1);
    const rowStartX = startX + gridWidth - rowWidth;

    return clampBoundsToCanvas(
      {
        x: rowStartX + column * (width + gapX),
        y: startY + row * (height + gapY),
        width,
        height,
      },
      canvas,
    );
  });
}

export function scaleBounds(bounds: Bounds[], resolution: CanvasResolution): Bounds[] {
  const canvas = getCanvasSize(resolution);
  if (!canvas) {
    return [];
  }

  const scaleX = canvas.width / 1920;
  const scaleY = canvas.height / 1080;

  return bounds.map((bound) =>
    clampBoundsToCanvas(
      {
        x: Math.round(bound.x * scaleX),
        y: Math.round(bound.y * scaleY),
        width: Math.round(bound.width * scaleX),
        height: Math.round(bound.height * scaleY),
      },
      canvas,
    )
  );
}

function createCenteredGrid(
  count: number,
  columns: number,
  rows: number,
  canvas: CanvasSize,
  options: { gapX: number; gapY: number; marginX: number; marginY: number },
): Bounds[] {
  const marginX = clampMargin(options.marginX, canvas.width, columns);
  const marginY = clampMargin(options.marginY, canvas.height, rows);
  const availableWidth = canvas.width - marginX * 2;
  const availableHeight = canvas.height - marginY * 2;
  const gapX = getSafeGap(options.gapX, availableWidth, columns);
  const gapY = getSafeGap(options.gapY, availableHeight, rows);
  const cellWidth = Math.max(1, Math.floor((availableWidth - gapX * (columns - 1)) / columns));
  const cellHeight = Math.max(1, Math.floor((availableHeight - gapY * (rows - 1)) / rows));
  const gridHeight = cellHeight * rows + gapY * (rows - 1);
  const startY = marginY + Math.floor((availableHeight - gridHeight) / 2);

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const itemsInRow = Math.min(columns, count - row * columns);
    const rowWidth = cellWidth * itemsInRow + gapX * (itemsInRow - 1);
    const rowStartX = marginX + Math.floor((availableWidth - rowWidth) / 2);

    return clampBoundsToCanvas(
      {
        x: rowStartX + column * (cellWidth + gapX),
        y: startY + row * (cellHeight + gapY),
        width: cellWidth,
        height: cellHeight,
      },
      canvas,
    );
  });
}

function getCanvasSize(resolution: CanvasResolution): CanvasSize | undefined {
  if (
    !Number.isFinite(resolution.width) ||
    !Number.isFinite(resolution.height) ||
    resolution.width < 1 ||
    resolution.height < 1
  ) {
    return undefined;
  }

  return {
    width: Math.floor(resolution.width),
    height: Math.floor(resolution.height),
  };
}

function normalizeCount(count: number): number {
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function clampMargin(margin: number, dimension: number, cells: number): number {
  return clamp(Math.max(0, margin), 0, Math.max(0, Math.floor((dimension - cells) / 2)));
}

function getSafeGap(gap: number, availableDimension: number, cells: number): number {
  if (cells <= 1) {
    return 0;
  }

  return clamp(
    Math.max(0, gap),
    0,
    Math.max(0, Math.floor((availableDimension - cells) / (cells - 1))),
  );
}

function clampBoundsToCanvas(bounds: Bounds, canvas: CanvasSize): Bounds {
  const x = clamp(Math.round(Number.isFinite(bounds.x) ? bounds.x : 0), 0, canvas.width - 1);
  const y = clamp(Math.round(Number.isFinite(bounds.y) ? bounds.y : 0), 0, canvas.height - 1);

  return {
    x,
    y,
    width: clamp(Math.round(Number.isFinite(bounds.width) ? bounds.width : 1), 1, canvas.width - x),
    height: clamp(Math.round(Number.isFinite(bounds.height) ? bounds.height : 1), 1, canvas.height - y),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
