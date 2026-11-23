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
      expect(html).toContain("Cloud Native Education");
      expect(html).toContain("Rawkode Academy");
      expect(html).not.toContain("OG/1200");
      expect(html).not.toContain(
        `<span class="template">${templateName}</span>`,
      );
    });
  }

  test("renders SVG technology logos inside centered object-fit: contain media frame", () => {
    const svgUrl =
      "https://content.rawkode.academy/technologies/kubernetes/icon.svg";
    const html = renderOpenGraphHtml(
      normalizePayload({
        title: "Kubernetes",
        text: SAMPLE_TEXT,
        image: svgUrl,
      }),
    );

    expect(html).toContain(`<div class="media"><img class="image" src="${svgUrl}" /></div>`);
    expect(html).toContain("object-fit: contain;");
    expect(html).not.toContain("object-fit: cover;");
  });

  test("renders raster cover images without edge-cropping inner borders", () => {
    const coverUrl =
      "https://content.rawkode.academy/videos/demo-episode/thumbnail.webp";
    const html = renderOpenGraphHtml(
      normalizePayload({
        title: "Hands-on Cloud Native",
        text: SAMPLE_TEXT,
        image: coverUrl,
      }),
    );

    expect(html).toContain(`<img class="image" src="${coverUrl}" />`);
    expect(html).toContain("display: flex;");
    expect(html).toContain("align-items: center;");
    expect(html).toContain("justify-content: center;");
    expect(html).toContain("object-fit: contain;");
  });
});
