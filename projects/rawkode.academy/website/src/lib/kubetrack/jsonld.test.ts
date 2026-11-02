import type { DocNode } from "@rawkodeacademy/rich-text";
import { describe, expect, it } from "vitest";
import { kubetrackJsonLd } from "./jsonld";
import type { KubeTrackReleaseEntry } from "./types";
import { toQuizProps } from "./view-model";

const doc = (text: string): DocNode =>
	({
		type: "doc",
		content: [{ type: "paragraph", content: [{ type: "text", text }] }],
	}) as DocNode;

const entry: KubeTrackReleaseEntry = {
	id: "1.37",
	data: {
		major: 1,
		minor: 37,
		title: "Kubernetes v1.37",
		codename: "Garhwal",
		summary: "Every Kubernetes v1.37 enhancement, explained.",
		body: doc("Intro"),
		releasedAt: new Date("2026-08-26T00:00:00Z"),
		publishedAt: new Date("2026-11-01T00:00:00Z"),
		updatedAt: new Date("2026-11-02T10:00:00Z"),
		features: [
			{
				id: "1.37/kep-1710",
				slug: "kep-1710",
				kep: 1710,
				title: "SELinux mount",
				stage: "stable",
				summary: "Relabel volumes with a mount option.",
				body: doc("Why"),
			},
			{
				id: "1.37/kep-4639",
				slug: "kep-4639",
				kep: 4639,
				title: "Image volumes",
				stage: "beta",
				summary: "Mount OCI images as volumes.",
				body: doc("Why"),
			},
		],
		quizQuestions: [
			{
				id: "1.37/q01",
				featureId: "1.37/kep-1710",
				kind: "single",
				prompt: doc("Which?"),
				choices: [
					{ id: "a", text: "One" },
					{ id: "b", text: "Two" },
				],
				answerIds: ["b"],
				explanation: doc("Because."),
			},
			{
				id: "1.37/q02",
				kind: "true_false",
				prompt: doc("True?"),
				choices: [
					{ id: "a", text: "True" },
					{ id: "b", text: "False" },
				],
				answerIds: ["a"],
				explanation: doc("Indeed."),
			},
		],
	},
};

const url = "https://rawkode.academy/kubetrack/1.37";

describe("kubetrackJsonLd", () => {
	const jsonLd = kubetrackJsonLd(entry, url);
	const [resource, quiz] = jsonLd["@graph"] as Record<string, unknown>[];

	it("describes the release as a LearningResource about Kubernetes", () => {
		expect(jsonLd["@context"]).toBe("https://schema.org");
		expect(resource).toMatchObject({
			"@type": "LearningResource",
			name: "Kubernetes v1.37",
			description: entry.data.summary,
			url,
			about: { "@type": "Thing", name: "Kubernetes" },
			educationalLevel: "Intermediate",
			timeRequired: "PT3M",
			datePublished: "2026-08-26T00:00:00.000Z",
			dateModified: "2026-11-02T10:00:00.000Z",
		});
	});

	it("lists each feature card as a part at url#slug", () => {
		expect(resource!.hasPart).toEqual([
			{
				"@type": "CreativeWork",
				name: "KEP-1710: SELinux mount",
				description: "Relabel volumes with a mount option.",
				url: `${url}#kep-1710`,
			},
			{
				"@type": "CreativeWork",
				name: "KEP-4639: Image volumes",
				description: "Mount OCI images as volumes.",
				url: `${url}#kep-4639`,
			},
		]);
	});

	it("adds a Quiz without the answer key", () => {
		expect(quiz).toMatchObject({
			"@type": "Quiz",
			url: `${url}#quiz`,
		});
		expect(quiz).not.toHaveProperty("numberOfQuestions");
		expect(JSON.stringify(jsonLd)).not.toContain("acceptedAnswer");
	});

	it("ignores a fragment on the page URL", () => {
		const withHash = kubetrackJsonLd(entry, `${url}#quiz`);
		expect((withHash["@graph"] as Record<string, unknown>[])[0]!.url).toBe(url);
	});
});

describe("toQuizProps", () => {
	it("renders rich text and links questions to their feature card", async () => {
		const render = async (node: DocNode) => ({
			html: `<p>${JSON.stringify(node).includes("Which?") ? "Which?" : "x"}</p>`,
		});
		const props = await toQuizProps(entry, render);
		expect(props[0]).toEqual({
			id: "1.37/q01",
			kind: "single",
			featureSlug: "kep-1710",
			stage: "stable",
			promptHtml: "<p>Which?</p>",
			explanationHtml: "<p>x</p>",
			choices: [
				{ id: "a", text: "One" },
				{ id: "b", text: "Two" },
			],
			answerIds: ["b"],
		});
		expect(props[1]).toMatchObject({
			id: "1.37/q02",
			kind: "true_false",
			featureSlug: undefined,
			stage: undefined,
		});
	});
});
