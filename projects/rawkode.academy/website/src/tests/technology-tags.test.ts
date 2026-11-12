import { describe, expect, it } from "vitest";
import { buildTechnologyTags } from "../lib/technology-tags";

const technologies = [
	{ id: "kubernetes", data: { name: "Kubernetes" } },
	{ id: "cert-manager", data: { name: "cert-manager" } },
];

describe("buildTechnologyTags", () => {
	it("links an id that is in the technologies collection", () => {
		expect(buildTechnologyTags(["kubernetes"], technologies)).toEqual([
			{ id: "kubernetes", label: "Kubernetes", href: "/technology/kubernetes" },
		]);
	});

	it("renders an id that is not in the collection as a plain label", () => {
		const [tag] = buildTechnologyTags(["dotfiles"], technologies);
		expect(tag).toEqual({ id: "dotfiles", label: "Dotfiles" });
		expect(tag).not.toHaveProperty("href");
	});

	it("keeps order and links only the known ids in a mixed list", () => {
		const tags = buildTechnologyTags(
			["linux", "cert-manager", "git"],
			technologies,
		);
		expect(tags.map((tag) => tag.href)).toEqual([
			undefined,
			"/technology/cert-manager",
			undefined,
		]);
		expect(tags.map((tag) => tag.label)).toEqual([
			"Linux",
			"cert-manager",
			"GIT",
		]);
	});

	it("links nothing when the technologies collection failed to load", () => {
		// optionalContent(getCollection("technologies"), []) yields [] on failure.
		const tags = buildTechnologyTags(["kubernetes", "nix"], []);
		expect(tags.every((tag) => tag.href === undefined)).toBe(true);
		expect(tags.map((tag) => tag.label)).toEqual(["Kubernetes", "NIX"]);
	});

	it("uses the given fallback label for unknown ids", () => {
		expect(buildTechnologyTags(["nixpkgs"], technologies, (id) => id)).toEqual([
			{ id: "nixpkgs", label: "nixpkgs" },
		]);
	});
});
