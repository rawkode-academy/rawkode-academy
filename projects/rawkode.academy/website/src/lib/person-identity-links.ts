interface PersonIdentityFields {
	github?: string | undefined;
	twitter?: string | undefined;
	bluesky?: string | undefined;
	linkedin?: string | undefined;
	mastodon?: string | undefined;
}

/** Full URLs after the people content transform; not a verification of ownership.
 * Generic website/YouTube destinations remain visible links, not identity claims.
 */
export function getPersonIdentityUrls(person: PersonIdentityFields): string[] {
	return [...new Set([
		person.github,
		person.twitter,
		person.bluesky,
		person.linkedin,
		person.mastodon,
	].filter((url): url is string => typeof url === "string" && url.length > 0))];
}
