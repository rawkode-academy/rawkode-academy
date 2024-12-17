import { GET } from "@/pages/image";
import { describe, expect, test } from "vitest";
import * as utf64 from "utf64";

const toArrayBuffer = async (
  data: typeof import("*?raw"),
): Promise<ArrayBufferLike> => {
  const encoder = new TextEncoder();
  return encoder.encode(data.default).buffer;
};

// HINT: curl 'http://localhost:4321/image' > src/test/fixtures/without-params.svg
const withoutParamsFixture = await import(
  "./fixtures/without-params.svg?raw"
).then(toArrayBuffer);

// HINT: curl 'http://localhost:4321/image?payload=MAtextAFAYHenloCWdisWisWdoggoGAN' > src/test/fixtures/with-text.svg
const withTextFixture = await import("./fixtures/with-text.svg?raw").then(
  toArrayBuffer,
);

// HINT: curl 'http://localhost:4321/image?payload=MAtextAFAYHenloCWdisWisWdoggoWXlWcattoGAN' > src/test/fixtures/with-ampersand-in-text.svg
const withAmpersandInTextFixture = await import(
  "./fixtures/with-ampersand-in-text.svg?raw"
).then(toArrayBuffer);

describe("/image", () => {
  describe("GET", () => {
    test("should return 200, when calling without any params", async () => {
      // @ts-ignore - not all properties are set for request
      const response = await GET({ request: { url: "http://localhost:4321" } });

      expect(response.status).toEqual(200);

      expect((await response.arrayBuffer()).byteLength).toEqual(
        withoutParamsFixture.byteLength,
      );
    });

    test("should return 200, when calling with a text", async () => {
      const payload = utf64.encode(
        JSON.stringify({ text: "Henlo, dis is doggo!" }),
      );

      const response = await GET({
        // @ts-ignore - not all properties are set for request
        request: { url: `http://localhost:4321?payload=${payload}` },
      });

      expect(response.status).toEqual(200);
      expect((await response.arrayBuffer()).byteLength).toEqual(
        withTextFixture.byteLength,
      );
    });

    test("should return 200 and render ampersand correctly", async () => {
      const payload = utf64.encode(
        JSON.stringify({ text: "Henlo, dis is doggo & catto!" }),
      );

      const response = await GET({
        // @ts-ignore - not all properties are set for request
        request: { url: `http://localhost:4321?payload=${payload}` },
      });

      expect(response.status).toEqual(200);
      expect((await response.arrayBuffer()).byteLength).toEqual(
        withAmpersandInTextFixture.byteLength,
      );
    });

    test("should return 200 and return an etag which should not change when called twice", async () => {
      const defaultTemplate = await import("../templates/default");
      const expectedHash = defaultTemplate.template.hash();

      const firstResponse = await GET({
        // @ts-ignore - not all properties are set for request
        request: { url: "http://localhost:4321" },
      });

      expect(firstResponse.status).toEqual(200);
      expect(firstResponse.headers.get("ETag")).toEqual(expectedHash);

      const secondResponse = await GET({
        // @ts-ignore - not all properties are set for request
        request: { url: "http://localhost:4321" },
      });

      expect(secondResponse.status).toEqual(200);
      expect(secondResponse.headers.get("ETag")).toEqual(expectedHash);
    });
  });
});
