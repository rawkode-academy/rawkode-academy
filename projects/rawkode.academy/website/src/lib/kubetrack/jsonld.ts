import type { KubeTrackReleaseEntry } from "./types";

const PUBLISHER_NAME = "Rawkode Academy";
/** Reading estimate: a minute per card, half a minute per question. */
const MINUTES_PER_CARD = 1;
const MINUTES_PER_QUESTION = 0.5;

function minutesRequired(cards: number, questions: number): number {
	return Math.max(
		1,
		Math.ceil(cards * MINUTES_PER_CARD + questions * MINUTES_PER_QUESTION),
	);
}

/**
 * schema.org payload for a KubeTrack release page: a LearningResource whose
 * parts are the feature cards (`url#slug`), plus the Quiz. The Quiz never
 * carries `acceptedAnswer`.
 */
export function kubetrackJsonLd(
	entry: KubeTrackReleaseEntry,
	url: string,
): Record<string, unknown> {
	const { data } = entry;
	const [pageUrl = url] = url.split("#");
	const origin = new URL(pageUrl).origin;
	const about = { "@type": "Thing", name: "Kubernetes" };
	const provider = {
		"@type": "Organization",
		name: PUBLISHER_NAME,
		url: origin,
	};
	const minutes = minutesRequired(
		data.features.length,
		data.quizQuestions.length,
	);

	const learningResource: Record<string, unknown> = {
		"@type": "LearningResource",
		"@id": `${pageUrl}#resource`,
		name: data.title,
		description: data.summary,
		url: pageUrl,
		inLanguage: "en",
		isAccessibleForFree: true,
		learningResourceType: "Flip book",
		educationalLevel: "Intermediate",
		timeRequired: `PT${minutes}M`,
		about,
		provider,
		datePublished: data.releasedAt.toISOString(),
		dateModified: data.updatedAt.toISOString(),
		hasPart: data.features.map((feature) => ({
			"@type": "CreativeWork",
			name: `KEP-${feature.kep}: ${feature.title}`,
			description: feature.summary,
			url: `${pageUrl}#${feature.slug}`,
		})),
	};

	const quiz: Record<string, unknown> = {
		"@type": "Quiz",
		"@id": `${pageUrl}#quiz`,
		name: `${data.title} quiz`,
		url: `${pageUrl}#quiz`,
		inLanguage: "en",
		isAccessibleForFree: true,
		educationalLevel: "Intermediate",
		about,
		provider,
		isPartOf: { "@id": `${pageUrl}#resource` },
	};

	return {
		"@context": "https://schema.org",
		"@graph": [learningResource, quiz],
	};
}
