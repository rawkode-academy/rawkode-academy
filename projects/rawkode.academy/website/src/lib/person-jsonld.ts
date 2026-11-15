import {
	getPersonIdentityUrls,
	type PersonIdentityFields,
} from "@/lib/person-identity-links";

export interface PersonJsonLdSource extends PersonIdentityFields {
	id: string;
	name: string;
}

export interface PersonJsonLd {
	"@type": "Person";
	name: string;
	url: string;
	sameAs?: string[];
}

/**
 * A schema.org Person that points at the person's profile on the site and
 * lists their social profiles as `sameAs`, so every author, creator and
 * profile page describes the same entity.
 */
export function buildPersonJsonLd(
	person: PersonJsonLdSource,
	siteUrl: string | URL,
): PersonJsonLd {
	const sameAs = getPersonIdentityUrls(person);

	return {
		"@type": "Person",
		name: person.name,
		url: new URL(`/people/${person.id}`, siteUrl).href,
		...(sameAs.length > 0 ? { sameAs } : {}),
	};
}
