import type { APIRoute } from "astro";
import {
  CACHE_SECONDS,
  canonicalPayloadJson,
  encodePayload,
  type Payload,
  PayloadError,
  payloadFromRequest,
  TEMPLATE_VERSION,
} from "@/lib/payload";
import { renderOpenGraphHtml } from "@/lib/render";

type ImageContext = Parameters<APIRoute>[0];
type RenderPng = (payload: Payload) => Promise<ArrayBuffer>;

const CACHE_CONTROL = `public, max-age=${CACHE_SECONDS}`;

const digestHex = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
};

const canonicalImageRequest = (request: Request, payload: Payload): Request => {
  const url = new URL(request.url);

  url.pathname = "/image";
  url.search = "";
  url.searchParams.set("v", TEMPLATE_VERSION);
  url.searchParams.set("payload", encodePayload(payload));

  return new Request(url, { method: "GET" });
};

const responseHeaders = (etag: string): HeadersInit => ({
  "Content-Type": "image/png",
  "Cache-Control": CACHE_CONTROL,
  "CDN-Cache-Control": CACHE_CONTROL,
  "X-Robots-Tag": "noindex",
  ETag: etag,
});

const maybeCache = (): Cache | undefined => {
  if (typeof caches === "undefined") {
    return undefined;
  }

  return (caches as unknown as { default: Cache }).default;
};

const getExecutionContext = (context: ImageContext): ExecutionContext => {
  const locals = context.locals as {
    cfContext?: ExecutionContext;
    runtime?: { cfContext?: ExecutionContext };
  };

  const cfContext = locals.cfContext ?? locals.runtime?.cfContext;

  if (!cfContext) {
    throw new Error("Cloudflare execution context is unavailable");
  }

  return cfContext;
};

export const renderScreenshot: RenderPng = async (payload) => {
  const { env } = await import("cloudflare:workers");
  const { launch } = await import("@cloudflare/playwright");
  const browser = await launch(env.BROWSER);

  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
    });

    await page.setContent(renderOpenGraphHtml(payload), {
      waitUntil: "networkidle",
    });

    const screenshot = await page.screenshot({
      type: "png",
      fullPage: false,
    });

    return new Uint8Array(screenshot).buffer;
  } finally {
    await browser.close();
  }
};

export const createImageResponse = async (
  context: ImageContext,
  renderPng: RenderPng = renderScreenshot,
): Promise<Response> => {
  let payload: Payload;

  try {
    payload = await payloadFromRequest(context.request);
  } catch (error) {
    if (error instanceof PayloadError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }

  const cache = maybeCache();
  const cacheKey = canonicalImageRequest(context.request, payload);
  const cachedResponse = await cache?.match(cacheKey);

  if (cachedResponse) {
    return cachedResponse;
  }

  const cfContext = getExecutionContext(context);
  const etag = `"${TEMPLATE_VERSION}-${await digestHex(
    canonicalPayloadJson(payload),
  )}"`;
  const response = new Response(await renderPng(payload), {
    status: 200,
    headers: responseHeaders(etag),
  });

  cfContext.waitUntil(
    cache?.put(cacheKey, response.clone()) ?? Promise.resolve(),
  );

  return response;
};

export const GET: APIRoute = (context) => createImageResponse(context);
export const POST: APIRoute = (context) => createImageResponse(context);
