import type { Bounds } from "../types";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

const blockedTags = new Set([
  "audio",
  "canvas",
  "embed",
  "iframe",
  "link",
  "meta",
  "object",
  "script",
  "style",
  "svg",
  "video",
]);

const allowedAttributes = new Set([
  "aria-label",
  "class",
  "data-value",
  "id",
  "role",
  "style",
  "title",
]);

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export interface DrawHtmlOptions {
  html: string;
  bounds: Bounds;
  opacity: number;
}

export async function drawHtmlFragment(
  context: CanvasRenderingContext2D,
  options: DrawHtmlOptions,
): Promise<void> {
  const safeHtml = sanitizeHtmlFragment(options.html);
  const svg = buildSvgDocument(safeHtml, options.bounds.width, options.bounds.height);
  const image = await getCachedSvgImage(svg);

  context.save();
  context.globalAlpha *= options.opacity;
  context.drawImage(
    image,
    options.bounds.x,
    options.bounds.y,
    options.bounds.width,
    options.bounds.height,
  );
  context.restore();
}

function getCachedSvgImage(svg: string): Promise<HTMLImageElement> {
  const existing = imageCache.get(svg);
  if (existing) {
    return existing;
  }

  const image = loadSvgAsImage(svg);
  imageCache.set(svg, image);

  if (imageCache.size > 40) {
    const [oldestKey] = imageCache.keys();
    imageCache.delete(oldestKey);
  }

  return image;
}

function buildSvgDocument(html: string, width: number, height: number): string {
  const styles = `
    * { box-sizing: border-box; }
    .html-canvas-root {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      color: #f6fbff;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .lower-third {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 10px;
      padding: 28px 34px;
      border-left: 10px solid #39d5c5;
      border-radius: 22px;
      background: linear-gradient(135deg, rgba(8, 14, 22, 0.94), rgba(24, 36, 47, 0.9));
      box-shadow: 0 22px 70px rgba(0, 0, 0, 0.38);
    }
    .lower-third .name {
      color: #ffffff;
      font-size: 44px;
      font-weight: 800;
      line-height: 1;
    }
    .lower-third .topic {
      color: #aeece5;
      font-size: 24px;
      font-weight: 600;
      line-height: 1.2;
    }
    .code-card {
      width: 100%;
      height: 100%;
      padding: 28px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 22px;
      background: rgba(8, 13, 20, 0.91);
      box-shadow: 0 22px 80px rgba(0, 0, 0, 0.36);
    }
    .code-card strong {
      display: block;
      margin-bottom: 16px;
      color: #ffb26f;
      font-size: 24px;
      line-height: 1.15;
    }
    .code-card pre {
      margin: 0;
      color: #dbf7f4;
      font: 600 21px/1.45 "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      white-space: pre-wrap;
    }
  `;

  return `
    <svg xmlns="${SVG_NAMESPACE}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject x="0" y="0" width="${width}" height="${height}">
        <div xmlns="${XHTML_NAMESPACE}">
          <style>${styles}</style>
          <div class="html-canvas-root">${html}</div>
        </div>
      </foreignObject>
    </svg>
  `;
}

function loadSvgAsImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to render HTML overlay into canvas"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function sanitizeHtmlFragment(source: string): string {
  const template = document.createElement("template");
  template.innerHTML = source;

  for (const node of Array.from(template.content.querySelectorAll("*"))) {
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();

    if (blockedTags.has(tag)) {
      element.remove();
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();

      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (name === "style") {
        const safeStyle = sanitizeInlineStyle(value);
        if (safeStyle.length === 0) {
          element.removeAttribute(attribute.name);
        } else {
          element.setAttribute(attribute.name, safeStyle);
        }
        continue;
      }

      if (!allowedAttributes.has(name) && !name.startsWith("data-")) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  return Array.from(template.content.childNodes)
    .map((node) => new XMLSerializer().serializeToString(node))
    .join("");
}

function sanitizeInlineStyle(style: string): string {
  return style
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .filter((declaration) => {
      const lower = declaration.toLowerCase();
      return !lower.includes("url(") && !lower.includes("expression(") && !lower.includes("@import");
    })
    .join("; ");
}
