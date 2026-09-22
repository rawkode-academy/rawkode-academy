import { readFileSync } from "node:fs";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";
import { academyLogoDownload } from "./branding";

describe("Academy logo downloads", () => {
	for (const name of ["monogram", "logo", "wordmark"]) {
		for (const color of ["#0c1626", "#ffffff"] as const) {
			it(`exports ${name} in ${color} without changing geometry or adding strokes`, () => {
				const original = readFileSync(
					`src/components/branding/logos/${name}.svg`,
					"utf8",
				);
				const url = academyLogoDownload(original, color);
				expect(url).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
				const output = decodeURIComponent(url.slice(url.indexOf(",") + 1));
				const before = parse(original);
				const after = parse(output);
				expect(after.querySelector("svg")?.getAttribute("fill")).toBe(color);
				expect(after.querySelector("svg")?.getAttribute("viewBox")).toBe(
					before.querySelector("svg")?.getAttribute("viewBox"),
				);
				expect(
					after.querySelectorAll("path").map((p) => p.getAttribute("d")),
				).toEqual(
					before.querySelectorAll("path").map((p) => p.getAttribute("d")),
				);
				expect(after.querySelectorAll("path").length).toBeGreaterThan(0);
				expect(after.querySelectorAll("style, [class], [stroke]")).toHaveLength(
					0,
				);
				expect(after.querySelectorAll("[fill]")).toHaveLength(1);
			});
		}
	}
});
