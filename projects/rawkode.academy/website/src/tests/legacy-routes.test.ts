import { describe, expect, it } from "vitest";
import { resolveLegacyRoute } from "../middleware/legacy-routes";

describe("legacy route resolver", () => {
	it("permanently redirects retired public pages to current hubs", () => {
		expect(
			resolveLegacyRoute(new URL("https://rawkode.academy/events")),
		).toEqual({
			kind: "redirect",
			status: 301,
			location: "https://rawkode.academy/watch",
		});
		expect(
			resolveLegacyRoute(new URL("https://rawkode.academy/community-day/")),
		).toEqual({
			kind: "redirect",
			status: 301,
			location: "https://rawkode.academy/about",
		});
		expect(resolveLegacyRoute(new URL("https://rawkode.academy/metal"))).toEqual(
			{
				kind: "redirect",
				status: 301,
				location: "https://rawkode.academy/technology/equinix-metal",
			},
		);
		expect(
			resolveLegacyRoute(new URL("https://rawkode.academy/organizations/consulting")),
		).toEqual({
			kind: "redirect",
			status: 301,
			location: "https://rawkode.academy/organizations/partnerships",
		});
		expect(
			resolveLegacyRoute(new URL("https://rawkode.academy/organizations/training/")),
		).toEqual({
			kind: "redirect",
			status: 301,
			location: "https://rawkode.academy/organizations/partnerships",
		});
	});

	it("temporarily redirects legacy sign-in while preserving query params", () => {
		expect(
			resolveLegacyRoute(
				new URL(
					"https://rawkode.academy/sign-in?returnTo=%2Fwatch%2Fdemo&utm_source=test",
				),
			),
		).toEqual({
			kind: "redirect",
			status: 302,
			location:
				"https://rawkode.academy/api/auth/sign-in?returnTo=%2Fwatch%2Fdemo&utm_source=test",
		});
	});

	it("permanently redirects legacy people slugs to GitHub-handle slugs", () => {
		expect(
			resolveLegacyRoute(new URL("https://rawkode.academy/people/adrian-mouat")),
		).toEqual({
			kind: "redirect",
			status: 301,
			location: "https://rawkode.academy/people/amouat",
		});
		expect(
			resolveLegacyRoute(
				new URL(
					"https://rawkode.academy/people/open-source-database-evangelist",
				),
			),
		).toEqual({
			kind: "redirect",
			status: 301,
			location: "https://rawkode.academy/people/askdba",
		});
		expect(
			resolveLegacyRoute(new URL("https://rawkode.academy/people/marino-wijay")),
		).toEqual({
			kind: "redirect",
			status: 301,
			location: "https://rawkode.academy/people/distributethe6ix",
		});
	});

	it("returns an empty noindex response for stale Partytown worker probes", () => {
		expect(
			resolveLegacyRoute(
				new URL(
					"https://rawkode.academy/_partytown/partytown-sandbox-sw.html?1769347131044",
				),
			),
		).toEqual({
			kind: "empty",
			status: 204,
			headers: {
				"Cache-Control": "public, max-age=3600",
				"X-Robots-Tag": "noindex, nofollow",
			},
		});
	});

	it("ignores unrelated routes", () => {
		expect(resolveLegacyRoute(new URL("https://rawkode.academy/shows"))).toBe(
			undefined,
		);
	});
});
