export interface PodcastSeriesHost {
	id: string;
	name: string;
}

export interface PodcastSeriesSource {
	id: string;
	name: string;
	description?: string;
	category?: string;
	subcategory?: string;
	imageUrl?: string;
	episodeCount?: number;
}

export interface BuildPodcastSeriesJsonLdInput {
	siteUrl: string;
	source: PodcastSeriesSource;
	hosts: ReadonlyArray<PodcastSeriesHost>;
	feedUrl: string;
	homePageUrl: string;
}

const PUBLISHER_NAME = "Rawkode Academy";
const PUBLISHER_LOGO_PATH = "/android-chrome-512x512.png";

function joinUrl(base: string, path: string): string {
	return new URL(path, base).href;
}

/**
 * Build a schema.org/PodcastSeries JSON-LD payload for a show page.
 *
 * PodcastSeries is the documented type for episodic audio/video shows;
 * Google's podcast surfaces and Apple Podcasts' web crawler both honour it.
 * Combined with the existing `subscribeLinks` UI, it makes a show
 * machine-discoverable as a podcast wherever the user opens it.
 */
export function buildPodcastSeriesJsonLd(
	input: BuildPodcastSeriesJsonLdInput,
): Record<string, unknown> {
	const { siteUrl, source, hosts, feedUrl, homePageUrl } = input;

	const jsonLd: Record<string, unknown> = {
		"@context": "https://schema.org",
		"@type": "PodcastSeries",
		name: source.name,
		url: homePageUrl,
		webFeed: feedUrl,
		inLanguage: "en",
		publisher: {
			"@type": "Organization",
			name: PUBLISHER_NAME,
			url: siteUrl,
			logo: {
				"@type": "ImageObject",
				url: joinUrl(siteUrl, PUBLISHER_LOGO_PATH),
			},
		},
	};

	if (source.description) {
		jsonLd.description = source.description;
	}

	if (source.imageUrl) {
		jsonLd.image = source.imageUrl;
	}

	const genres = [source.category, source.subcategory].filter(
		(value): value is string => typeof value === "string" && value.length > 0,
	);
	if (genres.length > 0) {
		jsonLd.genre = genres.join(" / ");
	}

	if (
		typeof source.episodeCount === "number" &&
		Number.isFinite(source.episodeCount) &&
		source.episodeCount >= 0
	) {
		jsonLd.numberOfEpisodes = Math.floor(source.episodeCount);
	}

	if (hosts.length > 0) {
		jsonLd.author = hosts.map((host) => ({
			"@type": "Person",
			name: host.name,
			url: joinUrl(siteUrl, `/people/${host.id}`),
		}));
	}

	return jsonLd;
}
