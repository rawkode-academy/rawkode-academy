import { Easing, interpolate, spring } from "remotion";
import type { CanvasResolution, RemotionCompositionId, StudioLayer } from "../types";

interface CompositionDefinition {
  durationInFrames: number;
  fps: number;
  render: (context: CanvasRenderingContext2D, params: CompositionRenderParams) => void;
}

interface CompositionRenderParams {
  frame: number;
  layer: StudioLayer;
  resolution: CanvasResolution;
}

const compositions: Record<RemotionCompositionId, CompositionDefinition> = {
  "rawkode-intro": {
    durationInFrames: 240,
    fps: 30,
    render: drawIntroComposition,
  },
  "rawkode-outro": {
    durationInFrames: 210,
    fps: 30,
    render: drawOutroComposition,
  },
};

export function drawRemotionCompositionLayer(
  context: CanvasRenderingContext2D,
  layer: StudioLayer,
  resolution: CanvasResolution,
  timestamp: number,
): void {
  const compositionId = layer.settings?.remotion?.compositionId;
  if (!compositionId) {
    return;
  }

  const composition = compositions[compositionId];
  const frame = ((timestamp / 1000) * composition.fps) % composition.durationInFrames;

  context.save();
  context.globalAlpha = layer.opacity;
  composition.render(context, {
    frame,
    layer,
    resolution,
  });
  context.restore();
}

function drawIntroComposition(context: CanvasRenderingContext2D, params: CompositionRenderParams): void {
  const { frame, layer, resolution } = params;
  const { x, y, width, height } = layer.bounds;
  const title = layer.settings?.remotion?.title ?? "Rawkode Live";
  const subtitle = layer.settings?.remotion?.subtitle ?? "Browser production console";
  const loop = frame / 240;
  const logoScale = spring({
    frame,
    fps: 30,
    config: { damping: 120, stiffness: 210 },
    durationInFrames: 44,
    from: 0.78,
    to: 1,
  });
  const titleReveal = interpolate(frame, [18, 58], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scan = interpolate(loop, [0, 1], [-width * 0.18, width * 1.12], {
    easing: Easing.linear,
    extrapolateRight: "wrap",
  });

  drawCompositionBase(context, params, "#061417", "#1a1712");
  drawVerticalLightColumns(context, x, y, width, height, frame, "#39d5c5");

  context.save();
  context.globalAlpha = 0.22;
  const sweep = context.createLinearGradient(x + scan - 180, y, x + scan + 180, y);
  sweep.addColorStop(0, "rgba(57, 213, 197, 0)");
  sweep.addColorStop(0.5, "rgba(57, 213, 197, 0.68)");
  sweep.addColorStop(1, "rgba(255, 146, 103, 0)");
  context.fillStyle = sweep;
  context.fillRect(x + scan - 180, y, 360, height);
  context.restore();

  const markX = x + width * 0.5;
  const markY = y + height * 0.42;
  context.save();
  context.translate(markX, markY);
  context.scale(logoScale, logoScale);
  context.rotate(Math.sin(frame / 38) * 0.045);
  roundedRect(context, -92, -92, 184, 184, 42);
  context.fillStyle = "#39d5c5";
  context.fill();
  context.fillStyle = "#071014";
  context.font = "900 62px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("RS", 0, 4);
  context.restore();

  drawRevealedText(context, {
    x: markX,
    y: y + height * 0.62,
    text: title,
    progress: titleReveal,
    font: "900 76px Inter, system-ui, sans-serif",
    align: "center",
  });

  context.fillStyle = `rgba(239, 248, 246, ${interpolate(titleReveal, [0.2, 1], [0, 0.78], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })})`;
  context.font = "700 28px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText(subtitle, markX, y + height * 0.69);
  context.textAlign = "start";

  drawEqualizer(context, width - 180, y + 72, frame, "#39d5c5");
}

function drawOutroComposition(context: CanvasRenderingContext2D, params: CompositionRenderParams): void {
  const { frame, layer, resolution } = params;
  const { x, y, width, height } = layer.bounds;
  const title = layer.settings?.remotion?.title ?? "Thanks for watching";
  const subtitle = layer.settings?.remotion?.subtitle ?? "Rawkode Live";
  const reveal = interpolate(frame, [10, 52], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const orbit = (frame / 210) * Math.PI * 2;

  drawCompositionBase(context, params, "#151018", "#2a170f");

  context.save();
  context.translate(x + width * 0.5, y + height * 0.46);
  for (let ring = 0; ring < 5; ring += 1) {
    const radius = 142 + ring * 48 + Math.sin(orbit + ring) * 8;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.strokeStyle = `rgba(${ring % 2 === 0 ? "57, 213, 197" : "255, 146, 103"}, ${0.18 - ring * 0.022})`;
    context.lineWidth = 5;
    context.stroke();
  }
  context.rotate(orbit * 0.2);
  roundedRect(context, -118, -118, 236, 236, 54);
  context.fillStyle = "#ff9167";
  context.fill();
  context.fillStyle = "#130c0a";
  context.font = "900 76px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("RS", 0, 5);
  context.restore();

  drawRevealedText(context, {
    x: x + width * 0.5,
    y: y + height * 0.69,
    text: title,
    progress: reveal,
    font: "900 70px Inter, system-ui, sans-serif",
    align: "center",
  });

  context.fillStyle = `rgba(239, 248, 246, ${interpolate(reveal, [0.2, 1], [0, 0.72], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })})`;
  context.font = "700 27px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText(subtitle, x + width * 0.5, y + height * 0.76);
  context.textAlign = "start";

  drawEqualizer(context, width - 180, y + 72, frame, "#ff9167");
}

function drawCompositionBase(
  context: CanvasRenderingContext2D,
  params: CompositionRenderParams,
  start: string,
  end: string,
): void {
  const { x, y, width, height } = params.layer.bounds;
  const gradient = context.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, start);
  gradient.addColorStop(0.46, "#102223");
  gradient.addColorStop(1, end);
  context.fillStyle = gradient;
  context.fillRect(x, y, width, height);

  context.strokeStyle = "rgba(255, 255, 255, 0.06)";
  context.lineWidth = 2;
  for (let lineX = x + 96; lineX < x + width; lineX += 168) {
    context.beginPath();
    context.moveTo(lineX, y);
    context.lineTo(lineX, y + height);
    context.stroke();
  }
  for (let lineY = y + 90; lineY < y + height; lineY += 118) {
    context.beginPath();
    context.moveTo(x, lineY);
    context.lineTo(x + width, lineY);
    context.stroke();
  }

  roundedRect(context, x + 96, y + 72, width - 192, height - 144, 34);
  context.strokeStyle = "rgba(255, 255, 255, 0.18)";
  context.stroke();
}

function drawVerticalLightColumns(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  frame: number,
  accent: string,
): void {
  context.save();
  context.globalAlpha = 0.18;
  context.fillStyle = accent;
  for (let index = 0; index < 12; index += 1) {
    const columnX = x + ((index * 188 + frame * 1.8) % (width + 140)) - 140;
    const columnWidth = index % 3 === 0 ? 34 : 18;
    context.fillRect(columnX, y, columnWidth, height);
  }
  context.restore();
}

function drawRevealedText(
  context: CanvasRenderingContext2D,
  options: {
    align: CanvasTextAlign;
    font: string;
    progress: number;
    text: string;
    x: number;
    y: number;
  },
): void {
  context.save();
  context.font = options.font;
  context.textAlign = options.align;
  context.textBaseline = "middle";
  const metrics = context.measureText(options.text);
  const width = metrics.width + 28;
  const left = options.align === "center" ? options.x - width / 2 : options.x;

  context.beginPath();
  context.rect(left, options.y - 58, width * options.progress, 116);
  context.clip();
  context.fillStyle = "#f8fbff";
  context.fillText(options.text, options.x, options.y);
  context.restore();

  context.save();
  context.globalAlpha = Math.sin(options.progress * Math.PI);
  context.fillStyle = "#39d5c5";
  roundedRect(context, left + width * options.progress - 8, options.y - 50, 16, 100, 8);
  context.fill();
  context.restore();
}

function drawEqualizer(context: CanvasRenderingContext2D, x: number, y: number, frame: number, accent: string): void {
  context.save();
  context.fillStyle = accent;
  for (let index = 0; index < 5; index += 1) {
    const height = 24 + Math.abs(Math.sin(frame / (8 + index * 1.8))) * 46;
    roundedRect(context, x + index * 24, y + 72 - height, 12, height, 6);
    context.fill();
  }
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
