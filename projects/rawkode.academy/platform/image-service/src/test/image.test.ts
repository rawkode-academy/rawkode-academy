import { createImageResponse } from "@/pages/image";
import { describe, expect, test, vi } from "vitest";
import {
  CACHE_SECONDS,
  decodePayload,
  encodePayload,
  normalizePayload,
  TEMPLATE_VERSION,
} from "@/lib/payload";

const png = new Uint8Array([137, 80, 78, 71]);
const renderPng = vi.fn(async () => png.buffer.slice(0));

const contextFor = (request: Request) =>
  ({
    request,
    locals: {
      runtime: {
        env: { BROWSER: {} },
        cfContext: {
          waitUntil: vi.fn(),
        },
      },
    },
  }) as any;

describe("/image", () => {
  test("encodes payloads as base64url JSON", () => {
    const payload = normalizePayload({ title: "Hello & welcome" });
    const encoded = encodePayload(payload);

    expect(encoded).not.toMatch(/[+/=]/u);
    expect(decodePayload(encoded)).toEqual(payload);
  });

  describe("GET", () => {
    test("returns png for a base64url payload", async () => {
      const payload = encodePayload(
        normalizePayload({ text: "Henlo, dis is doggo!" }),
      );
      const response = await createImageResponse(
        contextFor(
          new Request(`http://localhost:4321/image?payload=${payload}`),
        ),
        renderPng,
      );

      expect(response.status).toEqual(200);
      expect(response.headers.get("Content-Type")).toEqual("image/png");
      expect(response.headers.get("Cache-Control")).toEqual(
        `public, max-age=${CACHE_SECONDS}`,
      );
      expect(response.headers.get("X-Robots-Tag")).toEqual("noindex");
      expect(response.headers.get("ETag")).toContain(TEMPLATE_VERSION);
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
    });

    test("rejects invalid payloads", async () => {
      const response = await createImageResponse(
        contextFor(
          new Request("http://localhost:4321/image?payload=not-valid"),
        ),
        renderPng,
      );

      expect(response.status).toEqual(400);
    });
  });

  describe("POST", () => {
    test("returns png for a JSON body", async () => {
      const response = await createImageResponse(
        contextFor(
          new Request("http://localhost:4321/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Posted Image" }),
          }),
        ),
        renderPng,
      );

      expect(response.status).toEqual(200);
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
    });

    test("requires JSON bodies", async () => {
      const response = await createImageResponse(
        contextFor(
          new Request("http://localhost:4321/image", {
            method: "POST",
            body: "title=Nope",
          }),
        ),
        renderPng,
      );

      expect(response.status).toEqual(400);
    });
  });
});
