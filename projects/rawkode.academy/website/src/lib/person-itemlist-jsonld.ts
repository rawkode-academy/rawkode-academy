export interface PersonListEntry {
	id: string;
	name: string;
	avatarUrl?: string | undefined;
	// Full URLs only — the content-config transform on people resolves
	// the bare-handle frontmatter fields into URLs already.
	sameAs?: ReadonlyArray<string | undefined>;
}

export interface BuildPersonItemListJsonLdInput {
	siteUrl: string;
	listUrl: string;
	listName: string;
	people: ReadonlyArray<PersonListEntry>;
}

function joinUrl(base: string, path: string): string {
	return new URL(path, base).href;
}

/**
 * Build a schema.org ItemList JSON-LD payload for the people index page.
 *
 * Each ListItem embeds a Person item with name, profile url, avatar, and
 * sameAs links to external profiles. Same Person shape we emit on the
 * individual /people/<id> pages, grouped at the listing level.
 */
export function buildPersonItemListJsonLd(
	input: BuildPersonItemListJsonLdInput,
): Record<string, unknown> {
	const { siteUrl, listUrl, listName, people } = input;

	const itemListElement = people.map((person, index) => {
		const personUrl = joinUrl(siteUrl, `/people/${person.id}`);
		const sameAs = (person.sameAs ?? []).filter(
			(s): s is string => typeof s === "string" && s.length > 0,
		);
		const item: Record<string, unknown> = {
			"@type": "Person",
			name: person.name,
			url: personUrl,
		};
		if (person.avatarUrl) item.image = person.avatarUrl;
		if (sameAs.length > 0) item.sameAs = sameAs;
		return {
			"@type": "ListItem",
			position: index + 1,
			url: personUrl,
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
