import { describe, expect, test } from "vitest";
import { normalizePayload } from "@/lib/payload";
import { renderOpenGraphHtml } from "@/lib/render";

const templateNames = [
  "gradient",
  "dark",
  "simple-dark",
  "80s",
  "minimal",
  "modern",
  "glass",
  "simple",
  "default",
];

// Sample text to use for all templates
const SAMPLE_TEXT = "This is a preview of the template";

describe("Template Previews", () => {
  for (const templateName of templateNames) {
    test(`renders preview HTML for ${templateName} template`, () => {
      const html = renderOpenGraphHtml(
        normalizePayload({
          text: SAMPLE_TEXT,
          template: templateName,
        }),
      );

      expect(html).toContain("<!doctype html>");
      expect(html).toContain(SAMPLE_TEXT);
      expect(html).toContain(templateName);
    });
  }
});
