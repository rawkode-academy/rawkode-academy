import { describe, expect, it } from "vitest";
import { startTimeFromUrl, timestampHref } from "@/lib/video-deep-link";

const at = (path: string) => new URL(path, "https://rawkode.academy");

describe("video deep links", () => {
	it("builds fragment links that crawlers do not treat as new URLs", () => {
		expect(timestampHref(60)).toBe("#t=60");
		expect(timestampHref(61.9)).toBe("#t=61");
		expect(timestampHref(-5)).toBe("#t=0");
	});

	it("reads the start time from the fragment, then the query string", () => {
		expect(startTimeFromUrl(at("/watch/a#t=90"))).toBe(90);
		expect(startTimeFromUrl(at("/watch/a?t=30"))).toBe(30);
		expect(startTimeFromUrl(at("/watch/a?t=30#t=90"))).toBe(90);
		expect(startTimeFromUrl(at("/watch/a#t=0"))).toBe(0);
		expect(startTimeFromUrl(at("/watch/a"))).toBeUndefined();
		expect(startTimeFromUrl(at("/watch/a#t=abc"))).toBeUndefined();
		expect(startTimeFromUrl(at("/watch/a#t=-4"))).toBeUndefined();
		expect(startTimeFromUrl(at("/watch/a#t=1e3&x=1"))).toBeUndefined();
	});
});
