import { describe, expect, it } from "vitest";
import type { ThumbnailRenderParams } from "../src/contracts";
import { renderVideoThumbnailHtml, technologyIconDataUrl } from "../src/render";

const baseParams: ThumbnailRenderParams = {
	video: {
		id: "video123",
		slug: "hands-on-introduction-to-iroh",
		title: "Hands-on Introduction to Iroh",
		tagline: "Peer-to-peer apps, built from first principles",
		description: "A hands-on introduction to Iroh.",
		publishedAt: "2026-07-09T17:00:00.000Z",
	},
	show: {
		id: "rawkode-live",
		name: "Rawkode Live",
	},
	technology: {
		id: "iroh",
		name: "Iroh",
		iconSvg:
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="#7c7cff" d="M0 0h10v10H0z"/></svg>',
	},
	guests: [
		{
			id: "b5",
			name: "Brendan O'Brien",
			github: "b5",
			avatarUrl: "https://github.com/b5.png?size=512",
		},
	],
	source: {
		commitSha: "test",
		trigger: "test",
	},
};

describe("thumbnail html renderer", () => {
	it("renders the approved template ingredients", () => {
		const html = renderVideoThumbnailHtml({
			params: baseParams,
			backgroundImageDataUrl: "data:image/png;base64,abc",
			technologyIconSvg: baseParams.technology.iconSvg!,
		});

		expect(html).toContain("data:image/png;base64,abc");
		expect(html).toContain('aria-label="Rawkode Academy"');
		expect(html).toContain("Rawkode Live");
		expect(html).toContain("Peer-to-peer apps, built from first principles");
		expect(html).not.toContain("Hands-on Introduction to Iroh");
		expect(html).toContain("center-shield");
		expect(html).toContain("blur(2.4px)");
		expect(html).toContain("technology-svg");
		expect(html).toContain("data:image/svg+xml;base64,");
		expect(html).toContain("https://github.com/b5.png?size=512");
		expect(html).toContain("Brendan O&#39;Brien");
		expect(html).toContain('data-count="1"');
	});

	it("renders a compact four-guest layout and ignores extra guests", () => {
		const guests = Array.from({ length: 5 }, (_, index) => ({
			id: `guest-${index}`,
			name: `Guest ${index}`,
			github: `guest-${index}`,
			avatarUrl: `https://github.com/guest-${index}.png?size=512`,
		}));
		const html = renderVideoThumbnailHtml({
			params: { ...baseParams, guests },
			backgroundImageDataUrl: "data:image/png;base64,abc",
			technologyIconSvg: baseParams.technology.iconSvg!,
		});

		expect(html).toContain('data-count="4"');
		expect(html).toContain("--guest-columns: 2");
		expect(html).toContain("--guest-size: 112px");
		expect(html).toContain("Guest 3");
		expect(html).not.toContain("Guest 4");
	});

	it("renders technology SVG input as an image data URL", () => {
		const html = renderVideoThumbnailHtml({
			params: baseParams,
			backgroundImageDataUrl: "data:image/png;base64,abc",
			technologyIconSvg:
				'<svg onclick="alert(1)"><script>alert(1)</script><path d="M0 0"/></svg>',
		});

		expect(html).not.toContain("<script>");
		expect(html).not.toContain("onclick=");
		expect(html).toContain(technologyIconDataUrl(
			'<svg onclick="alert(1)"><script>alert(1)</script><path d="M0 0"/></svg>',
		));
		expect(html).toContain("technology-svg");
	});

	it("accepts SVG files with XML and doctype preamble", () => {
		const url = technologyIconDataUrl(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>`);

		expect(url).toContain("data:image/svg+xml;base64,");
		expect(atob(url.replace("data:image/svg+xml;base64,", ""))).toBe(
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>',
		);
	});
});
