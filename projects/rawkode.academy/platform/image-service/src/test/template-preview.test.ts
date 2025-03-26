import { describe, test, afterAll, expect, beforeAll } from "vitest";
import { GET } from "@/pages/image";
import * as utf64 from "utf64";

// @ts-expect-error .wasm files are not typed
import yogaWasm from "@/wasm/yoga.wasm";
// @ts-expect-error .wasm files are not typed
import resvgWasm from "@/wasm/resvg.wasm";
import { initWasm } from "@resvg/resvg-wasm";
import initYoga from "yoga-wasm-web";
import { init } from "satori/wasm";

// Initialize WASM files
const initResvgWasm = async () => {
  try {
    await initWasm(resvgWasm as WebAssembly.Module);
  } catch (err) {
    if (err instanceof Error && err.message.includes("Already initialized")) {
      return;
    }
    throw err;
  }
};

const initYogaWasm = async () => {
  const yoga = await initYoga(yogaWasm);
  init(yoga);
};

// Import all template modules
const templateModules = import.meta.glob<{ template: any }>(
  "/src/templates/*.ts",
  { eager: true },
);

// Extract template names (without .ts extension)
const templateNames = Object.keys(templateModules)
  .map(path => {
    const match = path.match(/\/([^\/]+)\.ts$/);
    return match ? match[1] : "";
  })
  .filter(name => name && name !== "README");

// Sample text to use for all templates
const SAMPLE_TEXT = "This is a preview of the template";

describe("Template Previews", () => {
  // This will store our preview data
  const previewData: Array<{ name: string; imageUrl: string }> = [];

  // Initialize WASM before running tests
  beforeAll(async () => {
    await Promise.all([initResvgWasm(), initYogaWasm()]);
  });

  // Generate a preview for each template
  for (const templateName of templateNames) {
    test(`should generate preview for ${templateName} template`, async () => {
      // Create payload with the template name
      const payload = utf64.encode(
        JSON.stringify({
          text: SAMPLE_TEXT,
          template: templateName,
          format: "png"
        })
      );

      // Generate the image
      const response = await GET({
        // @ts-ignore - not all properties are set for request
        request: { url: `http://localhost:4321?payload=${payload}` },
      });

      // Verify the response is successful
      expect(response.status).toEqual(200);

      // In a real GitHub Action, we would:
      // 1. Save the image to a file in the repository
      // 2. Commit and push the image
      // 3. Use the raw GitHub URL to the image

      // For now, we'll just use a placeholder URL that would be replaced in the action
      const imageUrl = `https://raw.githubusercontent.com/RawkodeAcademy/RawkodeAcademy/\${GITHUB_SHA}/projects/rawkode.academy/platform/image-service/preview-images/${templateName}.png`;

      // Add to preview data
      previewData.push({
        name: templateName,
        imageUrl
      });
    });
  }

  // After all tests, log the preview data
  // In the GitHub Action, we would save this to a file
  afterAll(() => {
    console.log("Template Preview Data:", JSON.stringify(previewData, null, 2));

    // In a real GitHub Action, we would write this to a file:
    // fs.writeFileSync("template-previews.json", JSON.stringify(previewData, null, 2));
  });
});
