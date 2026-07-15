import type {
  ActiveOverlay,
  ActiveSceneStinger,
  Bounds,
  CanvasResolution,
  OverlayTransitionEffect,
  StudioLayer,
  TransitionDirection,
} from "../types";
import { drawHtmlFragment, type HtmlDrawTransform } from "./htmlCanvasRenderer";
import { getRenderLayerStack } from "../studio/layerStack";
import { drawRemotionCompositionLayer } from "../remotion/brandCompositions";

export interface ProgramRenderOptions {
  activeOverlays?: Record<string, ActiveOverlay>;
  activeStinger?: ActiveSceneStinger;
  mediaVideoElements?: Map<string, HTMLVideoElement>;
  overlayTransitionProgresses?: Map<string, number>;
  overlayTransitionStarts?: Map<string, number>;
  stingerProgress?: number;
  stingerStartedAt?: number;
  layers: StudioLayer[];
  resolution: CanvasResolution;
  timestamp: number;
}

export async function renderProgramCanvas(
  context: CanvasRenderingContext2D,
  options: ProgramRenderOptions,
): Promise<void> {
  context.clearRect(0, 0, options.resolution.width, options.resolution.height);
  drawBaseStage(context, options.resolution);

  for (const layer of getRenderLayerStack(options.layers)) {
    if (layer.type === "background") {
      drawSceneBackground(context, layer);
    }

    if (layer.type === "camera") {
      const videoElement = getMediaVideoElement(layer, options);
      if (hasDrawableVideo(videoElement)) {
        drawCameraTile(context, layer, videoElement);
      }
    }

    if (layer.type === "screen") {
      const videoElement = getMediaVideoElement(layer, options);
      if (hasDrawableVideo(videoElement)) {
        drawScreenLayer(context, layer, videoElement);
      }
    }

    if (layer.type === "video") {
      drawVideoLayer(context, layer, options.timestamp);
    }

    if (layer.type === "remotion") {
      drawRemotionCompositionLayer(context, layer, options.resolution, options.timestamp);
    }

    if (layer.type === "html" && layer.html) {
      await drawHtmlFragment(context, {
        html: layer.html,
        bounds: layer.bounds,
        opacity: layer.opacity,
        transform: getOverlayTransform(layer, options),
      });
    }
  }

  drawActiveStinger(context, options);
}

function getMediaVideoElement(layer: StudioLayer, options: ProgramRenderOptions): HTMLVideoElement | undefined {
  return layer.sourceId ? options.mediaVideoElements?.get(layer.sourceId) : undefined;
}

function getOverlayTransform(
  layer: StudioLayer,
  options: ProgramRenderOptions,
): HtmlDrawTransform | undefined {
  const overlay = options.activeOverlays?.[layer.id];
  if (!overlay || overlay.phase === "visible") {
    return undefined;
  }

  const transition = overlay.phase === "entering" ? overlay.lifecycle.enter : overlay.lifecycle.exit;
  if (!transition) {
    return undefined;
  }

  const startedAt = options.overlayTransitionStarts?.get(layer.id) ?? options.timestamp;
  const progress =
    options.overlayTransitionProgresses?.get(layer.id) ??
    getTimedProgress(options.timestamp, startedAt, transition.durationSeconds ?? 0.2);
  return getTransitionTransform(transition, progress, overlay.phase === "entering", layer.bounds, options.timestamp);
}

function getTransitionTransform(
  transition: OverlayTransitionEffect,
  progress: number,
  isEntering: boolean,
  bounds: Bounds,
  timestamp: number,
): HtmlDrawTransform {
  const visibleProgress = isEntering ? progress : 1 - progress;
  const travelProgress = isEntering ? 1 - progress : progress;

  switch (transition.transition) {
    case "fade":
      return { opacity: visibleProgress };
    case "slide":
      return {
        ...getSlideOffset(transition.direction ?? "up", bounds, travelProgress),
        opacity: clamp(progress * 1.4, 0, 1),
      };
    case "flip":
      return {
        opacity: Math.max(0.08, visibleProgress),
        scaleX: transition.axis === "y" ? 1 : Math.max(0.05, visibleProgress),
        scaleY: transition.axis === "y" ? Math.max(0.05, visibleProgress) : 1,
      };
    case "typewriter":
      return {
        clipWidthRatio: Math.max(0.02, visibleProgress),
        opacity: Math.max(0.12, visibleProgress),
      };
    case "cube-spin":
      return {
        opacity: Math.max(0.08, visibleProgress),
        rotateRadians: (isEntering ? -1 : 1) * travelProgress * Math.PI * 0.32,
        scaleX: Math.max(0.18, visibleProgress),
      };
    case "wipe":
      return {
        clipWidthRatio: ["left", "right"].includes(transition.direction ?? "right") ? Math.max(0.02, visibleProgress) : 1,
        clipHeightRatio: ["up", "down"].includes(transition.direction ?? "right") ? Math.max(0.02, visibleProgress) : 1,
        opacity: Math.max(0.1, visibleProgress),
      };
    case "scale":
      return {
        opacity: visibleProgress,
        scaleX: 0.82 + visibleProgress * 0.18,
        scaleY: 0.82 + visibleProgress * 0.18,
      };
    case "blur":
      return {
        filter: `blur(${(1 - visibleProgress) * 18}px)`,
        opacity: visibleProgress,
      };
    case "glitch":
      return {
        opacity: Math.max(0.16, visibleProgress),
        translateX: Math.sin(timestamp / 22) * 18 * (1 - visibleProgress),
        translateY: Math.cos(timestamp / 19) * 8 * (1 - visibleProgress),
      };
    case "pop":
      return {
        opacity: visibleProgress,
        scaleX: 0.65 + visibleProgress * 0.35 + Math.sin(progress * Math.PI) * 0.08,
        scaleY: 0.65 + visibleProgress * 0.35 + Math.sin(progress * Math.PI) * 0.08,
      };
    case "cut":
      return { opacity: isEntering ? 1 : 0 };
  }
}

function getSlideOffset(
  direction: TransitionDirection,
  bounds: Bounds,
  progress: number,
): Pick<HtmlDrawTransform, "translateX" | "translateY"> {
  const distanceX = bounds.width * 0.42 * progress;
  const distanceY = bounds.height * 0.9 * progress;

  switch (direction) {
    case "left":
      return { translateX: distanceX };
    case "right":
      return { translateX: -distanceX };
    case "down":
      return { translateY: -distanceY };
    case "up":
      return { translateY: distanceY };
  }
}

function drawActiveStinger(context: CanvasRenderingContext2D, options: ProgramRenderOptions): void {
  const stinger = options.activeStinger;
  if (!stinger) {
    return;
  }

  const startedAt = options.stingerStartedAt ?? options.timestamp;
  const progress =
    options.stingerProgress ?? getTimedProgress(options.timestamp, startedAt, stinger.effect.durationSeconds ?? 2);

  drawMotionTransitionStinger(context, options.resolution, stinger.effect, progress, options.timestamp);
}

function drawMotionTransitionStinger(
  context: CanvasRenderingContext2D,
  resolution: CanvasResolution,
  effect: ActiveSceneStinger["effect"],
  progress: number,
  timestamp: number,
): void {
  context.save();
  const easedProgress = easeInOut(progress);
  const coverProgress = progress <= 0.5 ? easeInOut(progress * 2) : easeInOut((1 - progress) * 2);
  const accent = getTransitionAccent(effect.transition);

  switch (effect.transition) {
    case "fade":
      drawFadeStinger(context, resolution, coverProgress, accent);
      break;
    case "slide":
      drawSlideStinger(context, resolution, effect.direction ?? "left", coverProgress, progress, accent);
      break;
    case "flip":
      drawFlipStinger(context, resolution, coverProgress, effect.axis ?? "x", accent);
      break;
    case "typewriter":
      drawTypewriterStinger(context, resolution, progress, accent);
      break;
    case "cube-spin":
      drawCubeSpinStinger(context, resolution, coverProgress, easedProgress, effect.direction ?? "right", accent);
      break;
    case "wipe":
      drawWipeStinger(context, resolution, effect.direction ?? "right", progress, accent);
      break;
    case "scale":
      drawScaleStinger(context, resolution, coverProgress, accent);
      break;
    case "blur":
      drawBlurStinger(context, resolution, coverProgress, accent);
      break;
    case "glitch":
      drawGlitchStinger(context, resolution, coverProgress, timestamp, accent);
      break;
    case "pop":
      drawPopStinger(context, resolution, coverProgress, accent);
      break;
    case "cut":
      break;
  }

  if (effect.transition !== "cut") {
    drawStingerBrand(context, resolution, coverProgress, accent);
  }
  context.restore();
}

function drawFadeStinger(
  context: CanvasRenderingContext2D,
  resolution: CanvasResolution,
  coverProgress: number,
  accent: string,
): void {
  context.globalAlpha = clamp(coverProgress * 1.8, 0, 1);
  const gradient = context.createLinearGradient(0, 0, resolution.width, resolution.height);
  gradient.addColorStop(0, "#03070d");
  gradient.addColorStop(0.5, accent);
  gradient.addColorStop(1, "#05080d");
  context.fillStyle = gradient;
  context.fillRect(0, 0, resolution.width, resolution.height);
  drawStingerScanLines(context, resolution, coverProgress);
}

function drawSlideStinger(
  context: CanvasRenderingContext2D,
  resolution: CanvasResolution,
  direction: TransitionDirection,
  coverProgress: number,
  progress: number,
  accent: string,
): void {
  const horizontal = direction === "left" || direction === "right";
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  const exitSign = progress <= 0.5 ? sign : -sign;
  const travel = (horizontal ? resolution.width : resolution.height) * (1 - coverProgress) * exitSign;
  const panelCount = 4;

  for (let index = 0; index < panelCount; index += 1) {
    const stagger = (index - panelCount / 2) * 42 * (1 - coverProgress);
    context.globalAlpha = 1;
    context.fillStyle = index % 2 === 0 ? "#071014" : accent;

    if (horizontal) {
      const panelWidth = resolution.width / panelCount + 10;
      context.fillRect(travel + index * resolution.width / panelCount + stagger, 0, panelWidth, resolution.height);
    } else {
      const panelHeight = resolution.height / panelCount + 10;
      context.fillRect(0, travel + index * resolution.height / panelCount + stagger, resolution.width, panelHeight);
    }
  }

  context.globalAlpha = coverProgress * 0.42;
  context.fillStyle = "#ffffff";
  if (horizontal) {
    context.fillRect(resolution.width * 0.5 + travel * 0.12, 0, 10, resolution.height);
  } else {
    context.fillRect(0, resolution.height * 0.5 + travel * 0.12, resolution.width, 10);
  }
}

function drawFlipStinger(
  context: CanvasRenderingContext2D,
  resolution: CanvasResolution,
  coverProgress: number,
  axis: "x" | "y",
  accent: string,
): void {
  context.translate(resolution.width / 2, resolution.height / 2);
  if (axis === "x") {
    context.scale(Math.max(0.04, coverProgress), 1);
  } else {
    context.scale(1, Math.max(0.04, coverProgress));
  }

  const gradient = context.createLinearGradient(-resolution.width / 2, 0, resolution.width / 2, 0);
  gradient.addColorStop(0, "#05080d");
  gradient.addColorStop(0.5, accent);
  gradient.addColorStop(1, "#05080d");
  context.globalAlpha = 1;
  context.fillStyle = gradient;
  context.fillRect(-resolution.width / 2, -resolution.height / 2, resolution.width, resolution.height);
  context.strokeStyle = "rgba(255, 255, 255, 0.3)";
  context.lineWidth = 10;
  context.strokeRect(-resolution.width / 2 + 18, -resolution.height / 2 + 18, resolution.width - 36, resolution.height - 36);
}

function drawTypewriterStinger(
  context: CanvasRenderingContext2D,
  resolution: CanvasResolution,
  progress: number,
  accent: string,
): void {
  const phaseProgress = progress <= 0.5 ? easeInOut(progress * 2) : easeInOut((1 - progress) * 2);
  const width = resolution.width * phaseProgress;

  context.globalAlpha = clamp(phaseProgress * 1.6, 0, 1);
  context.fillStyle = "#04080e";
  context.fillRect(0, 0, width, resolution.height);
  context.fillStyle = accent;
  context.fillRect(Math.max(0, width - 18), 0, 18, resolution.height);
  context.globalAlpha = phaseProgress * 0.2;
  for (let row = 0; row < 12; row += 1) {
    context.fillRect(80, 90 + row * 74, Math.max(0, width - 160 - row * 28), 14);
  }
}

function drawCubeSpinStinger(
  context: CanvasRenderingContext2D,
  resolution: CanvasResolution,
  coverProgress: number,
  easedProgress: number,
  direction: TransitionDirection,
  accent: string,
): void {
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  const size = Math.max(resolution.width, resolution.height) * 1.55;

  context.translate(resolution.width / 2, resolution.height / 2);
  context.rotate((easedProgress - 0.5) * Math.PI * 0.62 * sign);
  context.scale(Math.max(0.1, coverProgress), 1);
  context.globalAlpha = clamp(coverProgress * 1.4, 0, 1);
  roundedRect(context, -size / 2, -size / 2, size, size, 72);
  context.fillStyle = "#05080d";
  context.fill();
  context.globalAlpha = clamp(coverProgress * 1.2, 0, 1);
  roundedRect(context, -size * 0.42, -size * 0.42, size * 0.84, size * 0.84, 62);
  context.fillStyle = accent;
  context.fill();
}

function drawWipeStinger(
  context: CanvasRenderingContext2D,
  resolution: CanvasResolution,
  direction: TransitionDirection,
  progress: number,
  accent: string,
): void {
  const coverProgress = progress <= 0.5 ? easeInOut(progress * 2) : easeInOut((1 - progress) * 2);
  const horizontal = direction === "left" || direction === "right";
  const size = (horizontal ? resolution.width : resolution.height) * coverProgress;

  context.globalAlpha = clamp(coverProgress * 1.6, 0, 1);
  context.fillStyle = "#05080d";
  if (horizontal) {
    const x = direction === "left" ? resolution.width - size : 0;
    context.fillRect(x, 0, size, resolution.height);
    context.fillStyle = accent;
    context.fillRect(direction === "left" ? x - 14 : size, 0, 14, resolution.height);
  } else {
    const y = direction === "up" ? resolution.height - size : 0;
    context.fillRect(0, y, resolution.width, size);
    context.fillStyle = accent;
    context.fillRect(0, direction === "up" ? y - 14 : size, resolution.width, 14);
  }
}

function drawScaleStinger(
  context: CanvasRenderingContext2D,
  resolution: CanvasResolution,
  coverProgress: number,
  accent: string,
): void {
  context.translate(resolution.width / 2, resolution.height / 2);
  context.scale(0.62 + coverProgress * 0.42, 0.62 + coverProgress * 0.42);
  context.globalAlpha = clamp(coverProgress * 1.8, 0, 1);
  roundedRect(context, -resolution.width / 2, -resolution.height / 2, resolution.width, resolution.height, 58);
  context.fillStyle = "#05080d";
  context.fill();
  context.globalAlpha = coverProgress * 0.42;
  context.fillStyle = accent;
  context.fillRect(-resolution.width / 2, -resolution.height / 2, resolution.width, resolution.height);
}

function drawBlurStinger(
  context: CanvasRenderingContext2D,
  resolution: CanvasResolution,
  coverProgress: number,
  accent: string,
): void {
  context.globalAlpha = clamp(coverProgress * 1.8, 0, 1);
  context.filter = `blur(${Math.round((1 - coverProgress) * 10)}px)`;
  context.fillStyle = "#05080d";
  context.fillRect(0, 0, resolution.width, resolution.height);
  context.filter = "none";
  context.globalAlpha = coverProgress * 0.34;
  context.fillStyle = accent;
  context.fillRect(0, 0, resolution.width, resolution.height);
}

function drawGlitchStinger(
  context: CanvasRenderingContext2D,
  resolution: CanvasResolution,
  coverProgress: number,
  timestamp: number,
  accent: string,
): void {
  context.globalAlpha = clamp(coverProgress * 1.8, 0, 1);
  context.fillStyle = "#05080d";
  context.fillRect(0, 0, resolution.width, resolution.height);
  context.fillStyle = accent;

  for (let slice = 0; slice < 18; slice += 1) {
    const y = slice * 62;
    const offset = Math.sin(timestamp / 24 + slice) * 70 * coverProgress;
    context.globalAlpha = coverProgress * (slice % 2 === 0 ? 0.46 : 0.2);
    context.fillRect(offset, y, resolution.width, 30);
  }
}

function drawPopStinger(
  context: CanvasRenderingContext2D,
  resolution: CanvasResolution,
  coverProgress: number,
  accent: string,
): void {
  const radius = Math.max(resolution.width, resolution.height) * coverProgress * 0.92;
  context.globalAlpha = clamp(coverProgress * 1.8, 0, 1);
  context.fillStyle = "#05080d";
  context.beginPath();
  context.arc(resolution.width / 2, resolution.height / 2, radius, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = coverProgress * 0.44;
  context.fillStyle = accent;
  context.beginPath();
  context.arc(resolution.width / 2, resolution.height / 2, radius * 0.72, 0, Math.PI * 2);
  context.fill();
}

function drawStingerBrand(
  context: CanvasRenderingContext2D,
  resolution: CanvasResolution,
  coverProgress: number,
  accent: string,
): void {
  if (coverProgress <= 0.08) {
    return;
  }

  context.save();
  context.globalAlpha = Math.min(1, coverProgress * 1.4);
  context.translate(resolution.width / 2, resolution.height / 2);
  roundedRect(context, -82, -82, 164, 164, 38);
  context.fillStyle = accent;
  context.fill();
  context.fillStyle = "#071014";
  context.font = "900 54px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("RS", 0, 3);
  context.restore();
}

function drawStingerScanLines(
  context: CanvasRenderingContext2D,
  resolution: CanvasResolution,
  opacity: number,
): void {
  context.save();
  context.globalAlpha = opacity * 0.14;
  context.fillStyle = "#ffffff";
  for (let y = 0; y < resolution.height; y += 18) {
    context.fillRect(0, y, resolution.width, 3);
  }
  context.restore();
}

function getTransitionAccent(transition: ActiveSceneStinger["effect"]["transition"]): string {
  switch (transition) {
    case "fade":
      return "#39d5c5";
    case "slide":
      return "#2f91ff";
    case "flip":
      return "#ff9167";
    case "typewriter":
      return "#39d5c5";
    case "cube-spin":
      return "#7688ff";
    case "wipe":
      return "#f7cf5f";
    case "scale":
      return "#67e8a5";
    case "blur":
      return "#b8c3ff";
    case "glitch":
      return "#ff4f7b";
    case "pop":
      return "#ffb26f";
    case "cut":
      return "#39d5c5";
  }
}

function getTimedProgress(timestamp: number, startedAt: number, durationSeconds: number): number {
  if (durationSeconds <= 0) {
    return 1;
  }

  return clamp((timestamp - startedAt) / (durationSeconds * 1000), 0, 1);
}

function easeInOut(progress: number): number {
  return progress < 0.5 ? 2 * progress * progress : 1 - ((-2 * progress + 2) ** 2) / 2;
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
  videoElement: HTMLVideoElement,
): void {
  const { x, y, width, height } = layer.bounds;
  const accent = layer.color ?? "#39d5c5";

  context.save();
  context.globalAlpha = layer.opacity;
  roundedRect(context, x, y, width, height, 28);
  context.fillStyle = "#131821";
  context.fill();
  drawCameraVideo(context, layer, videoElement);

  roundedRect(context, x, y, width, height, 28);
  context.strokeStyle = `${accent}88`;
  context.lineWidth = 4;
  context.stroke();

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

function hasDrawableVideo(videoElement: HTMLVideoElement | undefined): videoElement is HTMLVideoElement {
  return Boolean(
    videoElement &&
      videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      videoElement.videoWidth > 0 &&
      videoElement.videoHeight > 0,
  );
}

function drawCameraVideo(
  context: CanvasRenderingContext2D,
  layer: StudioLayer,
  videoElement: HTMLVideoElement,
): void {
  const { x, y, width, height } = layer.bounds;
  const source = getVideoCoverSource(videoElement, width / height);

  context.save();
  roundedRect(context, x, y, width, height, 28);
  context.clip();

  if (layer.sourceId === "source-host-camera") {
    context.save();
    context.translate(x + width, y);
    context.scale(-1, 1);
    context.drawImage(videoElement, source.x, source.y, source.width, source.height, 0, 0, width, height);
    context.restore();
  } else {
    context.drawImage(videoElement, source.x, source.y, source.width, source.height, x, y, width, height);
  }

  const shade = context.createLinearGradient(x, y, x, y + height);
  shade.addColorStop(0, "rgba(0, 0, 0, 0.04)");
  shade.addColorStop(0.7, "rgba(0, 0, 0, 0)");
  shade.addColorStop(1, "rgba(0, 0, 0, 0.52)");
  context.fillStyle = shade;
  context.fillRect(x, y, width, height);
  context.restore();
}

function getVideoCoverSource(
  videoElement: HTMLVideoElement,
  targetRatio: number,
): { height: number; width: number; x: number; y: number } {
  const sourceWidth = videoElement.videoWidth;
  const sourceHeight = videoElement.videoHeight;
  const sourceRatio = sourceWidth / sourceHeight;

  if (sourceRatio > targetRatio) {
    const width = sourceHeight * targetRatio;
    return {
      x: (sourceWidth - width) / 2,
      y: 0,
      width,
      height: sourceHeight,
    };
  }

  const height = sourceWidth / targetRatio;
  return {
    x: 0,
    y: (sourceHeight - height) / 2,
    width: sourceWidth,
    height,
  };
}

function drawScreenVideo(
  context: CanvasRenderingContext2D,
  layer: StudioLayer,
  videoElement: HTMLVideoElement,
): void {
  const { x, y, width, height } = layer.bounds;
  const backdropSource = getVideoCoverSource(videoElement, width / height);
  const destination = getVideoContainDestination(videoElement, layer.bounds);

  context.save();
  roundedRect(context, x, y, width, height, 24);
  context.clip();
  context.fillStyle = "#05080d";
  context.fillRect(x, y, width, height);

  context.save();
  context.filter = "blur(22px) saturate(0.84)";
  context.drawImage(
    videoElement,
    backdropSource.x,
    backdropSource.y,
    backdropSource.width,
    backdropSource.height,
    x - 32,
    y - 32,
    width + 64,
    height + 64,
  );
  context.restore();

  context.fillStyle = "rgba(5, 8, 13, 0.48)";
  context.fillRect(x, y, width, height);

  context.save();
  roundedRect(context, destination.x, destination.y, destination.width, destination.height, 14);
  context.clip();
  context.drawImage(videoElement, destination.x, destination.y, destination.width, destination.height);
  context.restore();

  if (destination.width < width - 2 || destination.height < height - 2) {
    roundedRect(context, destination.x, destination.y, destination.width, destination.height, 14);
    context.strokeStyle = "rgba(255, 255, 255, 0.2)";
    context.lineWidth = 2;
    context.stroke();
  }
  context.restore();
}

function getVideoContainDestination(
  videoElement: HTMLVideoElement,
  bounds: Bounds,
): { height: number; width: number; x: number; y: number } {
  const sourceRatio = videoElement.videoWidth / videoElement.videoHeight;
  const targetRatio = bounds.width / bounds.height;

  if (sourceRatio > targetRatio) {
    const width = bounds.width;
    const height = width / sourceRatio;
    return {
      x: bounds.x,
      y: bounds.y + (bounds.height - height) / 2,
      width,
      height,
    };
  }

  const height = bounds.height;
  const width = height * sourceRatio;
  return {
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y,
    width,
    height,
  };
}

function drawScreenLayer(
  context: CanvasRenderingContext2D,
  layer: StudioLayer,
  videoElement: HTMLVideoElement,
): void {
  const { x, y, width, height } = layer.bounds;

  context.save();
  context.globalAlpha = layer.opacity;
  roundedRect(context, x, y, width, height, 24);
  context.fillStyle = "#0b1018";
  context.fill();
  drawScreenVideo(context, layer, videoElement);

  roundedRect(context, x, y, width, height, 24);
  context.strokeStyle = "rgba(57, 213, 197, 0.42)";
  context.lineWidth = 4;
  context.stroke();

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
