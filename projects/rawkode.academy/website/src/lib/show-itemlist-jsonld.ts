export interface ShowListEntry {
	id: string;
	name: string;
	description?: string | undefined;
	imageUrl?: string | undefined;
	episodeCount?: number | undefined;
}

export interface BuildShowItemListJsonLdInput {
	siteUrl: string;
	listUrl: string;
	listName: string;
	shows: ReadonlyArray<ShowListEntry>;
}

const PUBLISHER_NAME = "Rawkode Academy";

function joinUrl(base: string, path: string): string {
	return new URL(path, base).href;
}

/**
 * Build a schema.org ItemList JSON-LD payload for the shows index page.
 *
 * Each ListItem embeds a PodcastSeries item — the show pages individually
 * emit PodcastSeries JSON-LD already; the listing's ItemList groups them
 * so Google can surface the whole library.
 */
export function buildShowItemListJsonLd(
	input: BuildShowItemListJsonLdInput,
): Record<string, unknown> {
	const { siteUrl, listUrl, listName, shows } = input;

	const publisher = {
		"@type": "Organization",
		name: PUBLISHER_NAME,
		url: siteUrl,
	};

	const itemListElement = shows.map((show, index) => {
		const showUrl = joinUrl(siteUrl, `/shows/${show.id}`);
		const item: Record<string, unknown> = {
			"@type": "PodcastSeries",
			name: show.name,
			url: showUrl,
			publisher,
		};
		if (show.description) item.description = show.description;
		if (show.imageUrl) item.image = show.imageUrl;
		if (typeof show.episodeCount === "number" && show.episodeCount > 0) {
			item.numberOfEpisodes = show.episodeCount;
		}
		return {
			"@type": "ListItem",
			position: index + 1,
			url: showUrl,
			item,
		};
	});

	return {
		"@context": "https://schema.org",
		"@type": "ItemList",
		name: listName,
		url: listUrl,
		numberOfItems: itemListElement.length,
		itemListElement,
	};
}
