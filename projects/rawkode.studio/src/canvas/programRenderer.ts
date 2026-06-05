import type { CanvasResolution, StudioLayer } from "../types";
import { drawHtmlFragment } from "./htmlCanvasRenderer";

export interface ProgramRenderOptions {
  layers: StudioLayer[];
  resolution: CanvasResolution;
  isRecording: boolean;
  timestamp: number;
}

export async function renderProgramCanvas(
  context: CanvasRenderingContext2D,
  options: ProgramRenderOptions,
): Promise<void> {
  context.clearRect(0, 0, options.resolution.width, options.resolution.height);
  drawBaseStage(context, options.resolution);

  for (const layer of getRenderStack(options.layers)) {
    if (!layer.enabled) {
      continue;
    }

    if (layer.type === "background") {
      drawSceneBackground(context, layer);
    }

    if (layer.type === "camera") {
      drawCameraTile(context, layer, options.timestamp);
    }

    if (layer.type === "screen") {
      drawScreenLayer(context, layer, options.timestamp);
    }

    if (layer.type === "video") {
      drawVideoLayer(context, layer, options.timestamp);
    }

    if (layer.type === "html" && layer.html) {
      await drawHtmlFragment(context, {
        html: layer.html,
        bounds: layer.bounds,
        opacity: layer.opacity,
      });
    }
  }

  drawProgramChrome(context, options);
}

function getRenderStack(layers: StudioLayer[]): StudioLayer[] {
  return layers
    .map((layer, index) => ({ layer, index }))
    .sort((left, right) => {
      const zIndex = getLayerZIndex(left.layer) - getLayerZIndex(right.layer);
      return zIndex === 0 ? left.index - right.index : zIndex;
    })
    .map(({ layer }) => layer);
}

function getLayerZIndex(layer: StudioLayer): number {
  if (typeof layer.zIndex === "number") {
    return layer.zIndex;
  }

  if (layer.type === "background") {
    return 0;
  }

  if (layer.type === "camera") {
    return 10;
  }

  if (layer.type === "screen" || layer.type === "video") {
    return 10;
  }

  return 30;
}

function drawBaseStage(context: CanvasRenderingContext2D, resolution: CanvasResolution): void {
  const gradient = context.createLinearGradient(0, 0, resolution.width, resolution.height);
  gradient.addColorStop(0, "#0a1119");
  gradient.addColorStop(0.52, "#11141c");
  gradient.addColorStop(1, "#19120f");

  context.fillStyle = gradient;
  context.fillRect(0, 0, resolution.width, resolution.height);

  context.strokeStyle = "rgba(255, 255, 255, 0.05)";
  context.lineWidth = 2;
  for (let x = 120; x < resolution.width; x += 160) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, resolution.height);
    context.stroke();
  }
  for (let y = 90; y < resolution.height; y += 120) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(resolution.width, y);
    context.stroke();
  }
}

function drawSceneBackground(context: CanvasRenderingContext2D, layer: StudioLayer): void {
  context.save();
  context.globalAlpha = layer.opacity;

  const { x, y, width, height } = layer.bounds;
  const glow = context.createRadialGradient(
    x + width * 0.72,
    y + height * 0.18,
    20,
    x + width * 0.72,
    y + height * 0.18,
    width * 0.7,
  );
  glow.addColorStop(0, "rgba(57, 213, 197, 0.24)");
  glow.addColorStop(0.52, "rgba(255, 146, 94, 0.11)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");

  context.fillStyle = glow;
  context.fillRect(x, y, width, height);

  context.restore();
}

function drawCameraTile(
  context: CanvasRenderingContext2D,
  layer: StudioLayer,
  timestamp: number,
): void {
  const { x, y, width, height } = layer.bounds;
  const accent = layer.color ?? "#39d5c5";
  const pulse = 0.45 + Math.sin(timestamp / 260 + layer.id.length) * 0.28;

  context.save();
  context.globalAlpha = layer.opacity;
  roundedRect(context, x, y, width, height, 28);
  context.fillStyle = "#131821";
  context.fill();

  const tileGradient = context.createLinearGradient(x, y, x + width, y + height);
  tileGradient.addColorStop(0, `${accent}33`);
  tileGradient.addColorStop(0.42, "rgba(255, 255, 255, 0.04)");
  tileGradient.addColorStop(1, "rgba(0, 0, 0, 0.18)");
  context.fillStyle = tileGradient;
  context.fill();

  context.strokeStyle = "rgba(255, 255, 255, 0.13)";
  context.lineWidth = 3;
  context.stroke();

  context.fillStyle = "rgba(255, 255, 255, 0.05)";
  for (let i = 0; i < 7; i += 1) {
    const barWidth = 9 + i * 3;
    const barHeight = 50 + Math.sin(timestamp / (190 + i * 16)) * 24;
    context.fillRect(x + 42 + i * 24, y + height - 94 - barHeight * pulse, barWidth, barHeight);
  }

  const avatarRadius = Math.min(width, height) * 0.16;
  const avatarX = x + width / 2;
  const avatarY = y + height / 2 - 14;
  const avatarGradient = context.createRadialGradient(
    avatarX - 22,
    avatarY - 26,
    8,
    avatarX,
    avatarY,
    avatarRadius,
  );
  avatarGradient.addColorStop(0, "#ffffff");
  avatarGradient.addColorStop(0.3, accent);
  avatarGradient.addColorStop(1, "#0c0f15");
  context.beginPath();
  context.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
  context.fillStyle = avatarGradient;
  context.fill();

  context.fillStyle = "rgba(0, 0, 0, 0.46)";
  roundedRect(context, x + 26, y + height - 82, width - 52, 52, 14);
  context.fill();

  context.fillStyle = "#f8fbff";
  context.font = "700 25px Inter, system-ui, sans-serif";
  context.textBaseline = "middle";
  context.fillText(layer.label ?? layer.name, x + 48, y + height - 56);

  context.fillStyle = accent;
  roundedRect(context, x + width - 130, y + height - 67, 78, 22, 11);
  context.fill();
  context.fillStyle = "#051014";
  context.font = "800 13px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText("LIVE", x + width - 91, y + height - 56);
  context.textAlign = "start";

  context.restore();
}

function drawScreenLayer(
  context: CanvasRenderingContext2D,
  layer: StudioLayer,
  timestamp: number,
): void {
  const { x, y, width, height } = layer.bounds;

  context.save();
  context.globalAlpha = layer.opacity;
  roundedRect(context, x, y, width, height, 24);
  context.fillStyle = "#0b1018";
  context.fill();

  const gradient = context.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, "rgba(57, 213, 197, 0.2)");
  gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
  gradient.addColorStop(1, "rgba(255, 145, 103, 0.16)");
  context.fillStyle = gradient;
  context.fill();

  context.strokeStyle = "rgba(255, 255, 255, 0.16)";
  context.lineWidth = 3;
  context.stroke();

  context.fillStyle = "rgba(255, 255, 255, 0.08)";
  for (let line = 0; line < 12; line += 1) {
    const lineY = y + 84 + line * 44;
    const lineWidth = width * (0.32 + ((line + 2) % 5) * 0.11);
    roundedRect(context, x + 78, lineY, lineWidth, 12, 6);
    context.fill();
  }

  const cursorX = x + width * 0.62 + Math.sin(timestamp / 900) * 18;
  const cursorY = y + height * 0.42 + Math.cos(timestamp / 760) * 14;
  context.fillStyle = "#f7fbff";
  context.beginPath();
  context.moveTo(cursorX, cursorY);
  context.lineTo(cursorX + 34, cursorY + 76);
  context.lineTo(cursorX + 52, cursorY + 48);
  context.lineTo(cursorX + 88, cursorY + 46);
  context.closePath();
  context.fill();

  context.fillStyle = "rgba(5, 10, 16, 0.78)";
  roundedRect(context, x + 30, y + height - 72, 204, 38, 12);
  context.fill();
  context.fillStyle = "#e9f8f6";
  context.font = "800 18px Inter, system-ui, sans-serif";
  context.textBaseline = "middle";
  context.fillText(layer.label ?? "Screen Share", x + 50, y + height - 52);

  context.restore();
}

function drawVideoLayer(
  context: CanvasRenderingContext2D,
  layer: StudioLayer,
  timestamp: number,
): void {
  const { x, y, width, height } = layer.bounds;
  const accent = layer.color ?? "#39d5c5";

  context.save();
  context.globalAlpha = layer.opacity;
  roundedRect(context, x, y, width, height, 26);
  const gradient = context.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, "#101622");
  gradient.addColorStop(0.44, "rgba(57, 213, 197, 0.22)");
  gradient.addColorStop(1, "rgba(255, 145, 103, 0.22)");
  context.fillStyle = gradient;
  context.fill();

  context.strokeStyle = "rgba(255, 255, 255, 0.15)";
  context.lineWidth = 3;
  context.stroke();

  context.fillStyle = "rgba(255, 255, 255, 0.06)";
  for (let band = 0; band < 10; band += 1) {
    context.fillRect(x + band * width * 0.12 - (timestamp / 70) % 90, y, 42, height);
  }

  const playX = x + width / 2;
  const playY = y + height / 2;
  context.fillStyle = "rgba(0, 0, 0, 0.44)";
  context.beginPath();
  context.arc(playX, playY, 84, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.moveTo(playX - 24, playY - 42);
  context.lineTo(playX - 24, playY + 42);
  context.lineTo(playX + 50, playY);
  context.closePath();
  context.fill();

  context.fillStyle = accent;
  roundedRect(context, x + 64, y + height - 112, 14, 58, 7);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "900 46px Inter, system-ui, sans-serif";
  context.textBaseline = "middle";
  context.fillText(layer.label ?? layer.name, x + 100, y + height - 82);

  context.restore();
}

function drawProgramChrome(
  context: CanvasRenderingContext2D,
  options: ProgramRenderOptions,
): void {
  context.save();

  context.fillStyle = options.isRecording ? "#ff6f61" : "#39d5c5";
  roundedRect(context, 1504, 34, 140, 40, 20);
  context.fill();
  context.fillStyle = "#071014";
  context.font = "800 18px Inter, system-ui, sans-serif";
  context.textBaseline = "middle";
  context.fillText(options.isRecording ? "REC" : "PROGRAM", 1534, 54);

  context.strokeStyle = "rgba(255, 255, 255, 0.18)";
  context.lineWidth = 2;
  roundedRect(context, 96, 72, options.resolution.width - 192, options.resolution.height - 144, 34);
  context.stroke();

  context.restore();
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}
