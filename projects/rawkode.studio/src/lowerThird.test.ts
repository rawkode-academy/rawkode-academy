import { describe, expect, it } from "vitest";
import { buildLowerThirdHtml } from "./lowerThird";

describe("buildLowerThirdHtml", () => {
  it("renders speaker and comment into the lower third fragment", () => {
    expect(buildLowerThirdHtml("Rawkode", "Ship it live")).toContain(
      '<span class="topic">Ship it live</span>',
    );
  });

  it("escapes comment input before rendering it as HTML", () => {
    const html = buildLowerThirdHtml("Rawkode", '<script>alert("owned")</script>');

    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;owned&quot;");
    expect(html).not.toContain("<script>");
  });

  it("keeps an empty comment from collapsing the lower third layout", () => {
    expect(buildLowerThirdHtml("", "")).toContain('<span class="topic"> </span>');
  });
});
