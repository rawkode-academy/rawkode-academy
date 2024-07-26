import { GET } from "@/pages/image";
import { describe, expect, test } from "vitest";
import * as utf64 from "utf64";

const toArrayBuffer = async (
	data: typeof import("*?raw")
): Promise<ArrayBuffer> => {
	const encoder = new TextEncoder();
	return encoder.encode(data.default).buffer;
};

const withoutParamsFixture = await import(
	"./fixtures/without-params.svg?raw"
).then(toArrayBuffer);

const withTextFixture = await import("./fixtures/with-text.svg?raw").then(
	toArrayBuffer
);

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
				withoutParamsFixture.byteLength
			);
		});

		test("should return 200, when calling with a text", async () => {
			const payload = utf64.encode(
				JSON.stringify({ text: "Henlo, dis is doggo!" })
			);

			const response = await GET({
				// @ts-ignore - not all properties are set for request
				request: { url: `http://localhost:4321?payload=${payload}` },
			});

			expect(response.status).toEqual(200);
			expect((await response.arrayBuffer()).byteLength).toEqual(
				withTextFixture.byteLength
			);
		});

		test("should return 200 and render ampersand correctly", async () => {
			const payload = utf64.encode(
				JSON.stringify({ text: "Henlo, dis is doggo & catto!" })
			);

			const response = await GET({
				// @ts-ignore - not all properties are set for request
				request: { url: `http://localhost:4321?payload=${payload}` },
			});

			expect(response.status).toEqual(200);
			expect((await response.arrayBuffer()).byteLength).toEqual(
				withAmpersandInTextFixture.byteLength
			);
		});
	});
});
